export const runtime = 'nodejs'

// app/api/ai/profile/route.ts
//
// GET  /api/ai/profile — returns merchant AI profile (or null if not yet created)
// POST /api/ai/profile — upserts merchant AI profile fields

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server-auth'
import { serviceSupabase } from '@/lib/supabase/service'
import type { GiwiBusinessType, GiwiLanguage } from '@/lib/types'

export async function GET(): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    const { data, error } = await serviceSupabase
      .from('merchant_ai_profile')
      .select('*')
      .eq('merchant_id', merchantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch AI profile' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? null })
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuth(async ({ merchantId }) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      business_description,
      target_customers,
      business_goal,
      business_type,
      preferred_language,
      onboarding_completed,
      last_brief_shown_at,
    } = body as Record<string, unknown>

    if (typeof business_description === 'string' && business_description.length > 300) {
      return NextResponse.json({ error: 'business_description max 300 characters' }, { status: 400 })
    }
    if (typeof target_customers === 'string' && target_customers.length > 200) {
      return NextResponse.json({ error: 'target_customers max 200 characters' }, { status: 400 })
    }
    if (typeof business_goal === 'string' && business_goal.length > 200) {
      return NextResponse.json({ error: 'business_goal max 200 characters' }, { status: 400 })
    }

    const validBusinessTypes: GiwiBusinessType[] = ['saas', 'agency', 'consultancy', 'professional_service', 'other']
    if (business_type !== undefined && business_type !== null && !validBusinessTypes.includes(business_type as GiwiBusinessType)) {
      return NextResponse.json({ error: 'Invalid business_type' }, { status: 400 })
    }

    const validLanguages: GiwiLanguage[] = ['english', 'hinglish']
    if (preferred_language !== undefined && !validLanguages.includes(preferred_language as GiwiLanguage)) {
      return NextResponse.json({ error: 'Invalid preferred_language' }, { status: 400 })
    }

    const upsertData: Record<string, unknown> = {
      merchant_id: merchantId,
      updated_at: new Date().toISOString(),
    }

    if (business_description !== undefined) upsertData.business_description = business_description
    if (target_customers !== undefined) upsertData.target_customers = target_customers
    if (business_goal !== undefined) upsertData.business_goal = business_goal
    if (business_type !== undefined) upsertData.business_type = business_type
    if (preferred_language !== undefined) upsertData.preferred_language = preferred_language
    if (onboarding_completed !== undefined) upsertData.onboarding_completed = onboarding_completed
    if (last_brief_shown_at !== undefined) upsertData.last_brief_shown_at = last_brief_shown_at

    const { data, error } = await serviceSupabase
      .from('merchant_ai_profile')
      .upsert(upsertData, { onConflict: 'merchant_id' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save AI profile' }, { status: 500 })
    }

    return NextResponse.json({ data })
  })
}
