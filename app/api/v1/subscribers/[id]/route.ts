import { NextRequest } from 'next/server'
import { serviceSupabase } from '@/lib/supabase/service'
import { authenticateApiKey, ok, err, preflight } from '../../_lib/apiAuth'

export function OPTIONS(): Response {
  return preflight()
}

/**
 * GET /api/v1/subscribers/:id
 *
 * Headers: X-API-Key: sub_live_…
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authenticateApiKey(request)
  if (!auth) return err('Invalid or missing API key', 401)

  const { id } = await context.params

  const { data, error } = await serviceSupabase
    .from('subscribers')
    .select(`
      id,
      customer_name,
      customer_email,
      status,
      start_date,
      next_renewal_date,
      last_payment_date,
      last_payment_amount,
      created_at,
      updated_at,
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
    .eq('id', id)
    .eq('merchant_id', auth.merchantId)
    .single()

  if (error || !data) return err('Subscriber not found', 404)

  return ok(data)
}

/**
 * PATCH /api/v1/subscribers/:id
 *
 * Updates subscriber status in Substrack's DB only.
 * Does NOT interact with Stripe or Cashfree.
 * Use for manual management: comped accounts, support re-activations.
 *
 * Headers: X-API-Key: sub_live_…
 * Body:    { "status": "active" | "cancelled" }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authenticateApiKey(request)
  if (!auth) return err('Invalid or missing API key', 401)

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('Request body must be valid JSON', 400)
  }

  const { status } = body as Record<string, unknown>

  if (!status || !['active', 'cancelled'].includes(status as string)) {
    return err(
      'Invalid or missing field: status. Allowed values: active, cancelled',
      400
    )
  }

  const nextStatus = status as 'active' | 'cancelled'

  // Verify the subscriber belongs to this merchant before mutating.
  // The merchant_id check prevents one merchant updating another's subscriber.
  const { data: existing, error: fetchError } = await serviceSupabase
    .from('subscribers')
    .select('id, plan_id, status')
    .eq('id', id)
    .eq('merchant_id', auth.merchantId)
    .single()

  if (fetchError || !existing) return err('Subscriber not found', 404)

  const cancelledAt = nextStatus === 'cancelled' && existing.status !== 'cancelled'
    ? new Date().toISOString()
    : undefined

  const updatePayload: Record<string, string | undefined> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (cancelledAt !== undefined) {
    updatePayload.cancelled_at = cancelledAt
  }

  const { data: updated, error: updateError } = await serviceSupabase
    .from('subscribers')
    .update(updatePayload)
    .eq('id', id)
    .select(`
      id,
      customer_name,
      customer_email,
      status,
      start_date,
      next_renewal_date,
      updated_at,
      subscription_plans ( id, name, price, currency, billing_cycle )
    `)
    .single()

  if (updateError || !updated) return err('Failed to update subscriber', 500)

  // Keep subscriber_count in sync with the subscribers table.
  // These RPCs already exist in the codebase — do not recreate them.
  if (nextStatus === 'cancelled' && existing.status === 'active') {
    await serviceSupabase.rpc('decrement_subscriber_count', {
      p_plan_id: existing.plan_id,
    })
  } else if (nextStatus === 'active' && existing.status !== 'active') {
    await serviceSupabase.rpc('increment_subscriber_count', {
      p_plan_id: existing.plan_id,
    })
  }

  return ok(updated)
}
