import { NextRequest } from 'next/server'
import { serviceSupabase } from '@/lib/supabase/service'
import { authenticateApiKey, err, preflight, CORS } from '../../_lib/apiAuth'

export function OPTIONS(): Response {
  return preflight()
}

/**
 * POST /api/v1/subscriptions/check
 *
 * Check whether an email has an active subscription under the
 * authenticated merchant. The primary endpoint for app integrations.
 *
 * Headers:  X-API-Key: sub_live_…
 * Body:     { "email": "user@example.com" }
 *
 * No subscription:  { success: true, data: { has_subscription: false, subscriber: null } }
 * Has subscription: { success: true, data: { has_subscription: true, subscriber: { … } } }
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateApiKey(request)
  if (!auth) return err('Invalid or missing API key', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('Request body must be valid JSON', 400)
  }

  const { email } = body as Record<string, unknown>

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return err('Missing required field: email', 400)
  }

  const normalized = email.toLowerCase().trim()

  if (normalized.length > 254) {
    return err('Email address too long', 400)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalized)) {
    return err('Invalid email format', 400)
  }

  const { data: subscriber, error } = await serviceSupabase
    .from('subscribers')
    .select(`
      id,
      customer_email,
      customer_name,
      status,
      start_date,
      next_renewal_date,
      last_payment_date,
      last_payment_amount,
      subscription_plans (
        id,
        name,
        price,
        currency,
        billing_cycle,
        features,
        description
      )
    `)
    .ilike('customer_email', normalized)
    .eq('merchant_id', auth.merchantId)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (error || !subscriber) {
    return Response.json(
      { success: true, data: { has_subscription: false, subscriber: null } },
      { status: 200, headers: CORS }
    )
  }

  const plan = subscriber.subscription_plans as unknown as Record<string, unknown>

  return Response.json(
    {
      success: true,
      data: {
        has_subscription: true,
        subscriber: {
          id: subscriber.id,
          email: subscriber.customer_email,
          name: subscriber.customer_name,
          status: subscriber.status,
          plan: {
            id: plan?.id ?? null,
            name: plan?.name ?? null,
            price: plan?.price ?? null,
            currency: plan?.currency ?? null,
            billing_cycle: plan?.billing_cycle ?? null,
            features: plan?.features ?? [],
            description: plan?.description ?? null,
          },
          start_date: subscriber.start_date,
          next_renewal_date: subscriber.next_renewal_date,
          last_payment_date: subscriber.last_payment_date,
          last_payment_amount: subscriber.last_payment_amount,
        },
      },
    },
    { status: 200, headers: CORS }
  )
}
