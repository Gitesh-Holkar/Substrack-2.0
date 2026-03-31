import { NextRequest } from 'next/server'
import { serviceSupabase } from '@/lib/supabase/service'
import { authenticateApiKey, ok, err, preflight } from '../_lib/apiAuth'

export function OPTIONS(): Response {
  return preflight()
}

/**
 * GET /api/v1/plans
 *
 * Headers: X-API-Key: sub_live_…
 *
 * Query params:
 *   active_only  boolean  default true
 *                         Pass "false" to include paused and archived plans.
 *
 * Note: The `archived_at` column used below was added in a database migration.
 * It is not in the base schema file but exists in the live DB and is
 * referenced in lib/types.ts. Do not remove this filter.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateApiKey(request)
  if (!auth) return err('Invalid or missing API key', 401)

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active_only') !== 'false'

  let query = serviceSupabase
    .from('subscription_plans')
    .select(`
      id,
      name,
      description,
      price,
      currency,
      billing_cycle,
      features,
      is_active,
      subscriber_count,
      created_at,
      updated_at
    `)
    .eq('merchant_id', auth.merchantId)
    .order('created_at', { ascending: false })

  if (activeOnly) {
    query = query.eq('is_active', true).is('archived_at', null)
  }

  const { data, error } = await query

  if (error) return err('Failed to fetch plans', 500)

  return ok(data ?? [])
}
