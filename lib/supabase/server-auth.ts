import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// AuthenticatedContext is what every API route handler receives
// after passing through requireAuth(). It guarantees:
//   - user is verified (getUser(), not getSession())
//   - merchantId is the verified user's ID
//   - supabase client is scoped to that user's session (RLS applies)
export interface AuthenticatedContext {
  user: User
  merchantId: string
  supabase: SupabaseClient
}

// requireAuth wraps an API route handler and handles auth boilerplate.
//
// Usage in any app/api/**/route.ts:
//
//   import { requireAuth } from '@/lib/supabase/server-auth'
//
//   export async function GET(request: NextRequest) {
//     return requireAuth(async ({ merchantId, supabase }) => {
//       const { data } = await supabase
//         .from('subscribers')
//         .select('*')
//         .eq('merchant_id', merchantId)
//
//       return NextResponse.json(data)
//     })
//   }
//
// If the user is not authenticated, it returns 401 automatically.
// No need to check auth in every handler.
export async function requireAuth(
  handler: (ctx: AuthenticatedContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return await handler({
      user,
      merchantId: user.id,
      supabase,
    })
  } catch (err) {
    // Unexpected error — don't leak internals to the client
    console.error('[requireAuth] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}