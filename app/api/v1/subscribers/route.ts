import { NextRequest } from 'next/server'
import { serviceSupabase } from '@/lib/supabase/service'
import {
  authenticateApiKey,
  ok,
  err,
  preflight,
  parsePagination,
} from '../_lib/apiAuth'

export function OPTIONS(): Response {
  return preflight()
}

const ALLOWED_STATUSES = [
  'active',
  'cancelled',
  'failed',
  'pending',
  'past_due',
] as const

/**
 * GET /api/v1/subscribers
 *
 * Headers: X-API-Key: sub_live_…
 *
 * Query params:
 *   page    number  default 1
 *   limit   number  default 20, max 100
 *   status  string  active | cancelled | failed | pending | past_due
 *   search  string  partial match on name or email (max 100 chars)
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateApiKey(request)
  if (!auth) return err('Invalid or missing API key', 401)

  const { searchParams } = new URL(request.url)
  const { page, limit, from, to } = parsePagination(searchParams)
  const status = searchParams.get('status')
  const rawSearch = searchParams.get('search')

  if (
    status &&
    !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])
  ) {
    return err(
      `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      400
    )
  }

  if (rawSearch !== null && rawSearch.length > 100) {
    return err('search parameter must be 100 characters or fewer', 400)
  }

  const search = rawSearch?.toLowerCase().trim()

  let query = serviceSupabase
    .from('subscribers')
    .select(
      `
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
      subscription_plans!plan_id (
        id,
        name,
        price,
        currency,
        billing_cycle
      )
    `,
      { count: 'exact' }
    )
    .eq('merchant_id', auth.merchantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) {
    query = query.eq('status', status)
  }

  if (search && search.length > 0) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) return err('Failed to fetch subscribers', 500)

  return ok(data ?? [], {
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  })
}
