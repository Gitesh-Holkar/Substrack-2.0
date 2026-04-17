// supabase/functions/notify-migration/index.ts
//
// Called when a merchant archives a plan and chooses "Notify to migrate".
// Sends one email per active subscriber on the archived plan.
// Does NOT cancel subscriptions — billing continues until the gateway
// stops renewing the archived plan at end of the subscriber's cycle.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActiveSubscriber {
  id: string
  customer_name: string
  customer_email: string
  next_renewal_date: string | null
}

interface ActivePlan {
  id: string
  name: string
  price: number
  billing_cycle: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const { planId } = body

    if (!planId || typeof planId !== 'string') {
      throw new Error('Missing required field: planId')
    }

    // Verify merchant owns this plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, merchant_id')
      .eq('id', planId)
      .eq('merchant_id', user.id)
      .single()

    if (planError || !plan) throw new Error('Plan not found or access denied')

    // Fetch merchant branding
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, email')
      .eq('id', user.id)
      .single()

    if (merchantError || !merchant) throw new Error('Merchant not found')

    // Fetch all active subscribers on this plan
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('id, customer_name, customer_email, next_renewal_date')
      .eq('merchant_id', user.id)
      .eq('plan_id', planId)
      .eq('status', 'active')

    if (subError) throw new Error('Failed to fetch subscribers: ' + subError.message)

    const activeSubscribers = (subscribers ?? []) as ActiveSubscriber[]

    if (activeSubscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Fetch all other active non-archived plans for this merchant
    const { data: activePlans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('id, name, price, billing_cycle')
      .eq('merchant_id', user.id)
      .eq('is_active', true)
      .is('archived_at', null)
      .neq('id', planId)
      .order('price', { ascending: true })

    if (plansError) throw new Error('Failed to fetch active plans: ' + plansError.message)

    const migrationTargets = (activePlans ?? []) as ActivePlan[]

    let emailsSent = 0

    for (const subscriber of activeSubscribers) {
      try {
        const endDate = subscriber.next_renewal_date
          ? new Date(subscriber.next_renewal_date).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'the end of your current billing cycle'

        const html = getMigrationEmailHtml(
          subscriber.customer_name,
          plan.name,
          merchant.business_name,
          endDate,
          migrationTargets,
        )

        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: subscriber.customer_email,
            from: `${merchant.business_name} <no-reply@substrack.work.gd>`,
            subject: `Important: Your ${plan.name} plan is being discontinued`,
            html,
          },
        })

        if (emailError) {
          console.error(`Migration email failed for ${subscriber.customer_email}:`, emailError)
        } else {
          emailsSent++
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Migration email error for subscriber ${subscriber.id}:`, msg)
      }
    }

    console.log(`notify-migration: ${emailsSent}/${activeSubscribers.length} emails sent for plan ${planId}`)

    return new Response(
      JSON.stringify({ success: true, emailsSent, total: activeSubscribers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('notify-migration error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})

function getMigrationEmailHtml(
  customerName: string,
  planName: string,
  businessName: string,
  endDate: string,
  activePlans: ActivePlan[],
): string {
  const planLinksHtml = activePlans.length > 0
    ? activePlans.map((p) => `
      <div style="margin-bottom:12px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">
        <p style="margin:0 0 4px;font-weight:600;color:#111827">${p.name}</p>
        <p style="margin:0 0 12px;color:#6b7280;font-size:14px">&#8377;${p.price.toFixed(2)} / ${p.billing_cycle}</p>
        <a href="https://substrack.work.gd/subscribe/${p.id}"
           style="display:inline-block;padding:8px 16px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
          Switch to ${p.name}
        </a>
      </div>`).join('')
    : `<p style="color:#6b7280;font-size:14px">Please contact ${businessName} for available plans.</p>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb">
  <div style="display:flex;align-items:center;margin-bottom:24px">
    <div style="width:10px;height:10px;background:#f59e0b;border-radius:50%;margin-right:8px;flex-shrink:0"></div>
    <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Action Required</p>
  </div>
  <h2 style="color:#111827;margin:0 0 16px;font-size:20px">Your plan is being discontinued</h2>
  <p style="color:#374151;line-height:1.6;margin:0 0 12px">Hi ${customerName},</p>
  <p style="color:#374151;line-height:1.6;margin:0 0 12px">
    <strong>${planName}</strong> from ${businessName} is being discontinued.
    Your access and billing continue normally until <strong>${endDate}</strong>.
  </p>
  <p style="color:#374151;line-height:1.6;margin:0 0 24px">
    To continue your subscription without interruption, please switch to one of the available
    plans before <strong>${endDate}</strong>. If you do not switch, your subscription will end
    on that date.
  </p>
  <div style="margin-bottom:24px">
    <p style="font-weight:600;color:#111827;margin:0 0 12px">Available plans from ${businessName}:</p>
    ${planLinksHtml}
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#9ca3af;font-size:12px;margin:0">
    You received this notice because you have an active subscription with ${businessName}.
    Your current billing continues normally until the date shown above.
  </p>
</div>
</body>
</html>`
}
