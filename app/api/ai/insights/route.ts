export const runtime = 'nodejs'

// app/api/ai/insights/route.ts
//
// POST /api/ai/insights — generates dashboard metric insights and chips.
// Called once per dashboard load. Caches result in merchant_ai_context.
// Returns GiwiInsights JSON.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server-auth'
import { serviceSupabase } from '@/lib/supabase/service'
import { GIWI_KNOWLEDGE_BASE } from '@/lib/giwi/knowledgeBase'
import type { GiwiInsights, MerchantContextDocument, MerchantAiProfile } from '@/lib/types'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}:generateContent`

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

interface AiContextInsightsRow {
  context_document: MerchantContextDocument | Record<string, never> | null
  dashboard_insights: GiwiInsights | Record<string, never> | null
  dashboard_insights_computed_at: string | null
  last_computed_at: string | null
}

interface MerchantProfileInsightRow {
  preferred_language?: MerchantAiProfile['preferred_language']
  business_type?: MerchantAiProfile['business_type']
  business_description?: MerchantAiProfile['business_description']
}

async function callGemini(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.4,
          maxOutputTokens: 2000,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json() as GeminiTextResponse
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    const { data: aiContext } = await serviceSupabase
      .from('merchant_ai_context')
      .select('context_document, dashboard_insights, dashboard_insights_computed_at, last_computed_at')
      .eq('merchant_id', merchantId)
      .single()

    const contextRow = aiContext as AiContextInsightsRow | null
    if (!contextRow || !contextRow.context_document || Object.keys(contextRow.context_document).length === 0) {
      return NextResponse.json({ error: 'Context not yet computed. Call /api/ai/context first.' }, { status: 404 })
    }

    const ctx = contextRow.context_document as MerchantContextDocument

    if (
      contextRow.dashboard_insights_computed_at &&
      contextRow.last_computed_at &&
      new Date(contextRow.dashboard_insights_computed_at) >= new Date(contextRow.last_computed_at) &&
      contextRow.dashboard_insights &&
      Object.keys(contextRow.dashboard_insights).length > 0
    ) {
      return NextResponse.json({ data: contextRow.dashboard_insights })
    }

    const { data: profile } = await serviceSupabase
      .from('merchant_ai_profile')
      .select('preferred_language, business_type, business_description')
      .eq('merchant_id', merchantId)
      .single()

    const merchantProfile = profile as MerchantProfileInsightRow | null
    const language = merchantProfile?.preferred_language ?? 'english'
    const isHinglish = language === 'hinglish'

    const languageInstruction = isHinglish
      ? 'Respond in formal Hinglish (natural mix of Hindi and English as used by Indian business professionals). Use "aap" not "tum". Explain English business terms in simple Hindi immediately after using them. Keep it professional and warm.'
      : 'Respond in clear professional English.'

    const contextSummary = `
Business has ${ctx.subscribers.active} active subscribers.
MRR: ₹${ctx.revenue.mrr.toFixed(2)} (${ctx.revenue.mrr_growth_percent > 0 ? '+' : ''}${ctx.revenue.mrr_growth_percent}% vs last month).
ARPU: ₹${ctx.revenue.arpu.toFixed(2)}.
Churn rate: ${ctx.subscribers.churn_rate_percent}% this month.
New this month: ${ctx.subscribers.new_this_month}. Cancelled: ${ctx.subscribers.cancelled_this_month}.
Failed payments this month: ${ctx.payments.failed_this_month} of ${ctx.payments.total_this_month} total (${ctx.payments.failed_payment_rate_percent}%).
Upcoming renewals in 7 days: ${ctx.subscribers.upcoming_renewals_7d}.
Plans: ${ctx.plans.map((plan) => `${plan.plan_name} (${plan.active_subscribers} active, ₹${plan.price}/${plan.billing_cycle})`).join(', ')}.
`

    const prompt = `${GIWI_KNOWLEDGE_BASE}

You are GIWI, the AI assistant inside Substrack, a subscription management platform. ${languageInstruction}

Merchant business data:
${contextSummary}

Generate insights for the dashboard. Return ONLY valid JSON in exactly this structure — no markdown, no explanation outside the JSON:

{
  "mrr": {
    "explanation": "2-3 sentence plain language explanation of what this merchant's MRR means for their specific business",
    "chips": ["What is MRR?", "<contextual follow-up based on their data>", "<second contextual follow-up>"]
  },
  "active_subscribers": {
    "explanation": "2-3 sentence explanation of their subscriber count and what it signals",
    "chips": ["What is subscriber growth rate?", "<contextual follow-up>", "<second contextual follow-up>"]
  },
  "churn_rate": {
    "explanation": "2-3 sentence explanation of their churn rate compared to healthy benchmarks",
    "chips": ["What is churn rate?", "<contextual follow-up>", "<second contextual follow-up>"]
  },
  "arpu": {
    "explanation": "2-3 sentence explanation of their ARPU and what it indicates about their pricing",
    "chips": ["What is ARPU?", "<contextual follow-up>", "<second contextual follow-up>"]
  },
  "insight_card": {
    "points": [
      "One specific revenue observation about this merchant's actual numbers",
      "One subscriber health observation with specific counts",
      "One risk or attention signal (or positive signal if no risks)",
      "One specific recommended action they can take right now"
    ]
  },
  "computed_at": "${new Date().toISOString()}"
}

Rules:
- chip[0] for each metric MUST be exactly the definition question shown (What is MRR?, What is churn rate?, etc.)
- chip[1] and chip[2] must be specific to this merchant's data, not generic questions
- insight_card.points must reference this merchant's actual numbers (rupee amounts, counts)
- Keep all text concise — chips max 8 words, insight points max 20 words each
`

    let rawResponse: string
    try {
      rawResponse = await callGemini(prompt)
    } catch {
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 503 })
    }

    let insights: GiwiInsights
    try {
      const cleaned = rawResponse.replace(/```json|```/g, '').trim()
      insights = JSON.parse(cleaned) as GiwiInsights
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const now = new Date().toISOString()
    await serviceSupabase
      .from('merchant_ai_context')
      .update({
        dashboard_insights: insights,
        dashboard_insights_computed_at: now,
      })
      .eq('merchant_id', merchantId)

    return NextResponse.json({ data: insights })
  })
}
