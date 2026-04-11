// app/api/ai/suggest-plans/route.ts
//
// POST /api/ai/suggest-plans
// Generates 3 subscription plan suggestions based on merchant business profile.
// Only called when merchant clicks "Generate with GIWI" in the Create Plan modal.
// Returns structured JSON — never creates plans directly.

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server-auth'
import { serviceSupabase } from '@/lib/supabase/service'
import { GIWI_KNOWLEDGE_BASE } from '@/lib/giwi/knowledgeBase'
import type { MerchantAiProfile, PlanSuggestion } from '@/lib/types'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`

export async function POST(): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    // Fetch merchant profile — required for contextual suggestions
    const { data: profile } = await serviceSupabase
      .from('merchant_ai_profile')
      .select('business_description, target_customers, business_goal, business_type, preferred_language, onboarding_completed')
      .eq('merchant_id', merchantId)
      .single()

    const prof = profile as MerchantAiProfile | null

    // Guard: profile must exist and be completed before generating plans
    if (!prof || !prof.onboarding_completed || !prof.business_description) {
      return NextResponse.json(
        { error: 'Business profile not set up. Please complete your AI profile in Settings → AI Assistant first.' },
        { status: 422 }
      )
    }

    // Fetch existing plans so suggestions do not duplicate them
    const { data: existingPlans } = await serviceSupabase
      .from('subscription_plans')
      .select('name, price, billing_cycle')
      .eq('merchant_id', merchantId)
      .is('archived_at', null)

    const existingPlansSummary = existingPlans && existingPlans.length > 0
      ? `Merchant already has these plans — do not suggest duplicates: ${existingPlans.map((p) => `${p.name} (₹${p.price}/${p.billing_cycle})`).join(', ')}`
      : 'Merchant has no existing plans yet.'

    const isHinglish = prof.preferred_language === 'hinglish'
    const languageInstruction = isHinglish
      ? 'Write plan names, descriptions, features, and positioning in formal Hinglish as used by Indian business professionals.'
      : 'Write in clear professional English.'

    const prompt = `${GIWI_KNOWLEDGE_BASE}

You are GIWI, the AI assistant inside Substrack. ${languageInstruction}

A merchant wants help creating subscription plans for their business. Generate exactly 3 distinct plan suggestions.

MERCHANT BUSINESS PROFILE:
Business type: ${prof.business_type ?? 'not specified'}
Description: ${prof.business_description}
Target customers: ${prof.target_customers ?? 'not specified'}
Current goal: ${prof.business_goal ?? 'not specified'}

${existingPlansSummary}

PLAN DESIGN RULES (from your knowledge base — apply strictly):
- Use exactly 3 tiers: Basic/Starter, Professional/Pro, Enterprise/Premium (or equivalent naming)
- Price gap between Basic and Pro must be 2.5x-3.5x
- Enterprise must be 6x-10x Basic price
- Use rupee-ending-in-9 pricing for entry tier (e.g., ₹499, ₹999, ₹1999)
- For Indian B2B, monthly billing is default unless business type clearly suits annual
- Features in Basic must be genuinely useful, not crippled
- Gate reporting, API access, bulk actions, priority support in Pro/Enterprise
- All prices must be realistic for Indian MSME market — not global SaaS pricing

Return ONLY valid JSON in exactly this structure — no markdown, no explanation:

{
  "suggestions": [
    {
      "name": "Plan name",
      "description": "2 sentence description of what this plan offers",
      "price": 999,
      "billing_cycle": "monthly",
      "trial_period_days": 0,
      "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
      "positioning": "One sentence: who is this plan best for"
    },
    {
      "name": "Plan name",
      "description": "2 sentence description",
      "price": 2999,
      "billing_cycle": "monthly",
      "trial_period_days": 0,
      "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
      "positioning": "One sentence: who is this plan best for"
    },
    {
      "name": "Plan name",
      "description": "2 sentence description",
      "price": 7999,
      "billing_cycle": "monthly",
      "trial_period_days": 0,
      "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
      "positioning": "One sentence: who is this plan best for"
    }
  ]
}

Rules:
- price must be an integer (no decimals)
- billing_cycle must be exactly one of: monthly, yearly, quarterly
- trial_period_days must be 0, 7, 14, or 30
- features array must have exactly 5 items, each max 60 characters
- All 3 suggestions must be meaningfully different in price, features, and target audience
`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    let rawResponse: string
    try {
      const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.6,
            maxOutputTokens: 1500,
          },
        }),
      })

      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } catch {
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    } finally {
      clearTimeout(timeout)
    }

    let parsed: { suggestions: PlanSuggestion[] }
    try {
      const cleaned = rawResponse.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned) as { suggestions: PlanSuggestion[] }
      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length !== 3) {
        throw new Error('Invalid suggestions structure')
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: parsed.suggestions })
  })
}
