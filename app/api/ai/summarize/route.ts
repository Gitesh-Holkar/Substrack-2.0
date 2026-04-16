export const runtime = 'nodejs'

// app/api/ai/summarize/route.ts
//
// POST /api/ai/summarize — called when a GIWI conversation ends.
// Extracts memory entries from the conversation and appends to merchant_ai_profile.
// Maximum 20 memory entries (rolling window). Older entries are dropped.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server-auth'
import { serviceSupabase } from '@/lib/supabase/service'
import { geminiPost } from '@/lib/giwi/geminiClient'
import type { GiwiMemoryEntry } from '@/lib/types'

interface SummaryConversationTurn {
  role: string
  content: string
}

interface GeminiSummaryResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

interface ProfileMemoryRow {
  conversation_memory: GiwiMemoryEntry[] | null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { rawConversation } = body as { rawConversation: SummaryConversationTurn[] }

    if (!Array.isArray(rawConversation) || rawConversation.length === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'empty conversation' })
    }

    if (rawConversation.length < 2) {
      return NextResponse.json({ status: 'skipped', reason: 'conversation too short' })
    }

    const conversationText = rawConversation
      .map((turn) => `${turn.role === 'giwi' ? 'GIWI' : 'Merchant'}: ${turn.content}`)
      .join('\n')

    const prompt = `You are extracting memory from a conversation between a merchant and GIWI (an AI business assistant).

Conversation:
${conversationText}

Extract ONLY meaningful information worth remembering across future conversations. Return ONLY valid JSON (no markdown):

{
  "intentions": [
    "Brief description of a decision or plan the merchant expressed (max 20 words each)"
  ],
  "facts": [
    "A persistent business fact revealed by the merchant (max 20 words each)"
  ]
}

Rules:
- intentions: things the merchant said they plan to do or are considering
- facts: stable business facts revealed by the merchant
- Maximum 3 intentions and 2 facts
- If nothing worth remembering was discussed, return {"intentions": [], "facts": []}
- Do not include anything from the knowledge base, only merchant-revealed information`

    let rawResponse: string
    try {
      const res = await geminiPost(
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 500,
          },
        },
        'GIWI summarize',
        10000
      )

      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
      const data = await res.json() as GeminiSummaryResponse
      rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[GIWI summarize] Gemini call failed:', message)
      return NextResponse.json({ status: 'skipped', reason: 'AI unavailable' })
    }

    let extracted: { intentions: string[]; facts: string[] }
    try {
      const cleaned = rawResponse.replace(/```json|```/g, '').trim()
      extracted = JSON.parse(cleaned) as { intentions: string[]; facts: string[] }
    } catch {
      return NextResponse.json({ status: 'skipped', reason: 'parse error' })
    }

    if (extracted.intentions.length === 0 && extracted.facts.length === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'nothing to remember' })
    }

    const { data: profile } = await serviceSupabase
      .from('merchant_ai_profile')
      .select('conversation_memory')
      .eq('merchant_id', merchantId)
      .single()

    const now = new Date()
    const existingMemory: GiwiMemoryEntry[] = ((profile as ProfileMemoryRow | null)?.conversation_memory ?? []) as GiwiMemoryEntry[]

    const validMemory = existingMemory.filter(
      (memory) => !memory.expires_at || new Date(memory.expires_at) > now
    )

    const newEntries: GiwiMemoryEntry[] = [
      ...extracted.intentions.slice(0, 3).map((text): GiwiMemoryEntry => ({
        type: 'intention',
        text: text.slice(0, 150),
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      })),
      ...extracted.facts.slice(0, 2).map((text): GiwiMemoryEntry => ({
        type: 'fact',
        text: text.slice(0, 150),
        created_at: now.toISOString(),
      })),
    ]

    const updatedMemory = [...validMemory, ...newEntries].slice(-20)

    await serviceSupabase
      .from('merchant_ai_profile')
      .upsert(
        {
          merchant_id: merchantId,
          conversation_memory: updatedMemory,
          updated_at: now.toISOString(),
        },
        { onConflict: 'merchant_id' }
      )

    return NextResponse.json({ status: 'saved', entries_added: newEntries.length })
  })
}
