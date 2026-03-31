import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { serviceSupabase } from '@/lib/supabase/service'

// TODO: rate limiting — requires Upstash Redis + @upstash/ratelimit.
// An in-memory implementation is NOT safe on serverless (each instance has
// separate memory, limits reset per cold start). Add when Redis is available.

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiAuthResult {
  merchantId: string
  keyId: string
}

// ── API key authentication ───────────────────────────────────────────────────
// Accepts X-API-Key header or Authorization: Bearer <key>.
// Hashes the raw key with SHA-256 and looks it up in the api_keys table.
// Returns null if missing, malformed, or not found in DB.

export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiAuthResult | null> {
  const raw =
    request.headers.get('X-API-Key') ??
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim()

  // Reject anything that doesn't start with sub_live_ without hitting the DB
  if (!raw || !raw.startsWith('sub_live_')) return null

  const keyHash = createHash('sha256').update(raw).digest('hex')

  const { data } = await serviceSupabase
    .from('api_keys')
    .select('id, merchant_id')
    .eq('key_hash', keyHash)
    .single()

  if (!data) return null

  // Update last_used_at without blocking the response.
  // Errors here are non-critical and intentionally swallowed.
  serviceSupabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { merchantId: data.merchant_id, keyId: data.id }
}

// ── CORS headers ─────────────────────────────────────────────────────────────

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
}

// ── Response helpers ──────────────────────────────────────────────────────────

export function ok<T>(data: T, meta?: Record<string, unknown>): Response {
  return Response.json(
    {
      success: true,
      data,
      ...(meta !== undefined ? { meta } : {}),
    },
    { status: 200, headers: CORS }
  )
}

export function err(message: string, status: number): Response {
  return Response.json(
    { success: false, error: message },
    { status, headers: CORS }
  )
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationResult {
  page: number
  limit: number
  from: number
  to: number
}

export function parsePagination(searchParams: URLSearchParams): PaginationResult {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
  )
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to }
}
