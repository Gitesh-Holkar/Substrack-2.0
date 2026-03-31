import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Environment variable guard ───────────────────────────────────────────────
// createClient() does NOT throw when given undefined — it silently creates a
// broken client that returns 401 on every query with no useful error message.
// We throw explicitly here so the mistake surfaces immediately at startup.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error(
    '[lib/supabase/service.ts] Missing env var: NEXT_PUBLIC_SUPABASE_URL'
  )
}

if (!serviceRoleKey) {
  throw new Error(
    '[lib/supabase/service.ts] Missing env var: SUPABASE_SERVICE_ROLE_KEY\n' +
    'Get it from: Supabase Dashboard → Project Settings → API → service_role key'
  )
}

// This client bypasses Row Level Security.
// NEVER import this into client-side code or Edge functions.
// ALWAYS scope every query with .eq('merchant_id', …) or equivalent.
export const serviceSupabase: SupabaseClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)
