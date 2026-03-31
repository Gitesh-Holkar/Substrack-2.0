// Node.js runtime is required — this file uses createHash and randomBytes
// from Node's built-in crypto module, unavailable in the Edge runtime.
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceSupabase } from '@/lib/supabase/service'
import { createHash, randomBytes } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status, headers: CORS })
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

// Gets the merchant ID from the dashboard session (JWT cookie).
// Returns null if session is missing or expired.
async function getSessionMerchantId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

/**
 * GET /api/admin/keys
 * Lists API keys for the authenticated merchant (dashboard session only).
 * The raw key is never returned — only prefix and metadata.
 */
export async function GET(): Promise<Response> {
  const merchantId = await getSessionMerchantId()
  if (!merchantId) return json({ success: false, error: 'Unauthorized' }, 401)

  const { data, error } = await serviceSupabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (error) return json({ success: false, error: 'Failed to fetch API keys' }, 500)

  return json({ success: true, data: data ?? [] })
}

/**
 * POST /api/admin/keys
 * Creates a new API key. Returns the raw key ONCE — never retrievable again.
 * Body: { "name": "My App" }
 */
export async function POST(request: NextRequest): Promise<Response> {
  const merchantId = await getSessionMerchantId()
  if (!merchantId) return json({ success: false, error: 'Unauthorized' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON' }, 400)
  }

  const { name } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return json(
      { success: false, error: 'Key name is required (minimum 2 characters)' },
      400
    )
  }

  if (name.trim().length > 60) {
    return json(
      { success: false, error: 'Key name must be 60 characters or fewer' },
      400
    )
  }

  // Hard limit: max 10 keys per merchant
  const { count } = await serviceSupabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)

  if ((count ?? 0) >= 10) {
    return json(
      {
        success: false,
        error: 'Maximum of 10 API keys per account. Revoke an existing key first.',
      },
      400
    )
  }

  // sub_live_ + 40 hex chars = 160 bits of entropy
  const rawKey = `sub_live_${randomBytes(20).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  // First 16 chars stored for display: "sub_live_xxxxxxx…"
  const keyPrefix = rawKey.substring(0, 16)

  const { data, error } = await serviceSupabase
    .from('api_keys')
    .insert({
      merchant_id: merchantId,
      name: name.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) return json({ success: false, error: 'Failed to create API key' }, 500)

  // raw_key is in this response ONLY. Not stored anywhere. Merchant must copy now.
  return json({ success: true, data: { ...data, raw_key: rawKey } }, 201)
}

/**
 * DELETE /api/admin/keys?id=<uuid>
 * Permanently revokes a key. Access stops immediately.
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  const merchantId = await getSessionMerchantId()
  if (!merchantId) return json({ success: false, error: 'Unauthorized' }, 401)

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ success: false, error: 'Missing required query param: id' }, 400)

  // .eq('merchant_id', merchantId) ensures a merchant can only delete their own keys
  const { error } = await serviceSupabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) return json({ success: false, error: 'Failed to revoke API key' }, 500)

  return json({ success: true })
}
