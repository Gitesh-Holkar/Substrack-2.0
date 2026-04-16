export const runtime = 'nodejs'

// app/api/ai/context/route.ts
//
// POST /api/ai/context — refreshes the merchant context document.
// Called when GIWI panel opens (with 5-minute debounce on client side).
// Writes to merchant_ai_context using serviceSupabase (bypasses RLS).

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server-auth'
import { serviceSupabase } from '@/lib/supabase/service'
import { computeMerchantContext, computePlanBadges } from '@/lib/giwi/contextComputer'

const DEBOUNCE_MINUTES = 5

interface ExistingAiContextRow {
  last_computed_at: string
  is_computing: boolean
  computing_started_at: string | null
}

export async function POST(): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    const { data: existing } = await serviceSupabase
      .from('merchant_ai_context')
      .select('last_computed_at, is_computing, computing_started_at')
      .eq('merchant_id', merchantId)
      .single()

    const existingContext = existing as ExistingAiContextRow | null
    const now = new Date()

    if (existingContext) {
      const lastComputed = new Date(existingContext.last_computed_at)
      const minutesSince = (now.getTime() - lastComputed.getTime()) / (1000 * 60)
      if (minutesSince < DEBOUNCE_MINUTES) {
        return NextResponse.json({ status: 'cached', computed_at: existingContext.last_computed_at })
      }

      if (existingContext.is_computing && existingContext.computing_started_at) {
        const computingStarted = new Date(existingContext.computing_started_at)
        const minutesComputing = (now.getTime() - computingStarted.getTime()) / (1000 * 60)
        if (minutesComputing < 2) {
          return NextResponse.json({ status: 'computing' })
        }
      }
    }

    await serviceSupabase
      .from('merchant_ai_context')
      .upsert(
        {
          merchant_id: merchantId,
          is_computing: true,
          computing_started_at: now.toISOString(),
        },
        { onConflict: 'merchant_id' }
      )

    try {
      const contextDocument = await computeMerchantContext(merchantId)
      const badgeData = computePlanBadges(contextDocument.plans)

      await serviceSupabase
        .from('merchant_ai_context')
        .upsert(
          {
            merchant_id: merchantId,
            context_document: contextDocument,
            badge_data: badgeData,
            last_computed_at: now.toISOString(),
            is_computing: false,
            computing_started_at: null,
          },
          { onConflict: 'merchant_id' }
        )

      return NextResponse.json({ status: 'computed', computed_at: now.toISOString() })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[GIWI context] Context computation failed:', message)
      await serviceSupabase
        .from('merchant_ai_context')
        .upsert(
          {
            merchant_id: merchantId,
            is_computing: false,
            computing_started_at: null,
          },
          { onConflict: 'merchant_id' }
        )
      return NextResponse.json({ error: 'Context computation failed', code: 'COMPUTATION_ERROR' }, { status: 500 })
    }
  })
}
