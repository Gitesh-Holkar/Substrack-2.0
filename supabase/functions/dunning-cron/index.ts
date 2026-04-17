// supabase/functions/dunning-cron/index.ts
//
// Scheduled daily at 00:30 UTC (6:00 AM IST) via supabase/config.toml.
// Finds all past_due subscribers where next_retry_at <= now.
// Advances dunning step, sends correct email, or cancels after exhaustion.
//
// Dunning schedule (Day 0 = original payment failure):
//   Day 0:  onPaymentFailed → step=1, Day 1 email sent, next_retry_at = Day 1
//   Day 1:  cron finds step=1 → Day 3 email sent, step→2, next_retry_at = Day 3  (+2 days)
//   Day 3:  cron finds step=2 → Day 7 email sent, step→3, next_retry_at = Day 7  (+4 days)
//   Day 7:  cron finds step=3 → subscriber cancelled, resubscribe email sent
//
// NO payment retry — RBI e-mandate and NPCI UPI rules prevent merchant-initiated
// retries for Indian card and UPI mandates. Email-only dunning.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PastDueSubscriber {
  id: string
  merchant_id: string
  plan_id: string
  customer_name: string
  customer_email: string
  dunning_step: number
  last_payment_amount: number | null
  start_date: string
}

interface MerchantRow {
  business_name: string
  email: string
}

interface PlanRow {
  name: string
  billing_cycle: string
  trial_period_days: number
  price: number
}

interface HigherPlanRow {
  id: string
  name: string
  price: number
  billing_cycle: string
}

function dunningDay3Html(
  customerName: string,
  planName: string,
  amount: number,
  businessName: string,
  merchantEmail: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb">
  <h2 style="color:#92400e;margin:0 0 16px">Payment still pending — action may be needed</h2>
  <p style="color:#374151;line-height:1.6">Hi ${customerName},</p>
  <p style="color:#374151;line-height:1.6">We have been unable to process your payment of <strong>&#8377;${amount.toFixed(2)}</strong> for your <strong>${planName}</strong> subscription with ${businessName}.</p>
  <div style="background:#fffbeb;border:1px solid #fde68a;padding:15px;border-radius:6px;margin:16px 0">
    <p style="margin:0;color:#92400e">Please check your UPI autopay mandate or ensure your payment method has sufficient balance to avoid cancellation.</p>
  </div>
  <p style="color:#374151;line-height:1.6">We will try once more in a few days.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:14px">Questions? <a href="mailto:${merchantEmail}" style="color:#3b82f6">${merchantEmail}</a></p>
  <p style="color:#6b7280;font-size:14px">&#8212; ${businessName}</p>
</div></body></html>`
}

function dunningDay7Html(
  customerName: string,
  planName: string,
  amount: number,
  businessName: string,
  merchantEmail: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #fecaca">
  <h2 style="color:#991b1b;margin:0 0 16px">Final notice &#8212; subscription at risk</h2>
  <p style="color:#374151;line-height:1.6">Hi ${customerName},</p>
  <div style="background:#fef2f2;border:1px solid #fecaca;padding:15px;border-radius:6px;margin:16px 0">
    <p style="margin:0;color:#991b1b"><strong>This is our final attempt to collect your payment of &#8377;${amount.toFixed(2)} for ${planName}.</strong></p>
    <p style="margin:8px 0 0;color:#991b1b">If we cannot collect payment, your subscription will be cancelled.</p>
  </div>
  <p style="color:#374151;line-height:1.6">Please check your UPI mandate or payment method immediately.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:14px">Questions? <a href="mailto:${merchantEmail}" style="color:#3b82f6">${merchantEmail}</a></p>
  <p style="color:#6b7280;font-size:14px">&#8212; ${businessName}</p>
</div></body></html>`
}

function resubscribeHtml(
  customerName: string,
  planName: string,
  businessName: string,
  resubscribeUrl: string,
  higherPlan: HigherPlanRow | null,
  higherPlanUrl: string | null,
): string {
  const upsell = higherPlan && higherPlanUrl
    ? `<div style="margin:24px 0;padding:16px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd">
        <p style="color:#0369a1;font-weight:600;margin:0 0 4px">Or explore an upgrade</p>
        <p style="color:#374151;font-size:14px;margin:0 0 12px">${higherPlan.name} &#8212; &#8377;${higherPlan.price.toFixed(2)} / ${higherPlan.billing_cycle}</p>
        <a href="${higherPlanUrl}" style="display:inline-block;padding:10px 20px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">Explore ${higherPlan.name}</a>
      </div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb">
  <h2 style="color:#111827;margin:0 0 16px">Your subscription has been cancelled</h2>
  <p style="color:#374151;line-height:1.6">Hi ${customerName},</p>
  <p style="color:#374151;line-height:1.6">Your <strong>${planName}</strong> subscription with ${businessName} has been cancelled after multiple failed payment attempts.</p>
  <p style="color:#374151;line-height:1.6">You can resubscribe anytime &#8212; your history is saved.</p>
  <div style="margin:24px 0">
    <a href="${resubscribeUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Resubscribe to ${planName}</a>
  </div>
  ${upsell}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">You received this because you had an active subscription with ${businessName}.</p>
</div></body></html>`
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()

  const { data: subscribers, error: fetchError } = await supabase
    .from('subscribers')
    .select(`
      id, merchant_id, plan_id, customer_name, customer_email,
      dunning_step, last_payment_amount, start_date
    `)
    .eq('status', 'past_due')
    .lte('next_retry_at', now.toISOString())

  if (fetchError) {
    console.error('dunning-cron fetch error:', fetchError.message)
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  const rows = (subscribers ?? []) as PastDueSubscriber[]
  console.log(`dunning-cron: processing ${rows.length} past_due subscribers`)

  let advanced = 0
  let cancelled = 0
  let errors = 0

  for (const sub of rows) {
    try {
      const [merchantResult, planResult] = await Promise.all([
        supabase.from('merchants').select('business_name, email').eq('id', sub.merchant_id).single(),
        supabase.from('subscription_plans').select('name, billing_cycle, trial_period_days, price').eq('id', sub.plan_id).single(),
      ])

      const merchant = merchantResult.data as MerchantRow | null
      const plan = planResult.data as PlanRow | null

      if (!merchant || !plan) {
        console.error('dunning-cron: missing merchant or plan for subscriber:', sub.id)
        errors++
        continue
      }

      const trialDays = plan.trial_period_days ?? 0
      if (trialDays > 0) {
        const trialEnd = new Date(sub.start_date)
        trialEnd.setDate(trialEnd.getDate() + trialDays)
        if (now < trialEnd) {
          await supabase
            .from('subscribers')
            .update({ status: 'active', dunning_step: 0, dunning_started_at: null, next_retry_at: null })
            .eq('id', sub.id)
          console.log('dunning-cron: subscriber still in trial — cleared dunning:', sub.id)
          continue
        }
      }

      const amount = sub.last_payment_amount ?? 0
      const planName = plan.name

      if (sub.dunning_step === 1) {
        const nextRetryAt = new Date(now)
        nextRetryAt.setDate(nextRetryAt.getDate() + 2)

        await supabase
          .from('subscribers')
          .update({ dunning_step: 2, next_retry_at: nextRetryAt.toISOString() })
          .eq('id', sub.id)

        await supabase.functions.invoke('send-email', {
          body: {
            to: sub.customer_email,
            from: `${merchant.business_name} <no-reply@substrack.work.gd>`,
            subject: `Payment still pending — action may be needed`,
            html: dunningDay3Html(sub.customer_name, planName, amount, merchant.business_name, merchant.email),
          },
        })

        advanced++
        console.log('dunning-cron: step->2 (Day 3 email) for:', sub.id)
      } else if (sub.dunning_step === 2) {
        const nextRetryAt = new Date(now)
        nextRetryAt.setDate(nextRetryAt.getDate() + 4)

        await supabase
          .from('subscribers')
          .update({ dunning_step: 3, next_retry_at: nextRetryAt.toISOString() })
          .eq('id', sub.id)

        await supabase.functions.invoke('send-email', {
          body: {
            to: sub.customer_email,
            from: `${merchant.business_name} <no-reply@substrack.work.gd>`,
            subject: `Final notice — your subscription is at risk`,
            html: dunningDay7Html(sub.customer_name, planName, amount, merchant.business_name, merchant.email),
          },
        })

        advanced++
        console.log('dunning-cron: step->3 (Day 7 email) for:', sub.id)
      } else if (sub.dunning_step === 3) {
        await supabase
          .from('subscribers')
          .update({
            status: 'cancelled',
            cancelled_at: now.toISOString(),
            dunning_step: 0,
            dunning_started_at: null,
            next_retry_at: null,
          })
          .eq('id', sub.id)

        await supabase.rpc('decrement_subscriber_count', { p_plan_id: sub.plan_id })

        const { data: higherPlans } = await supabase
          .from('subscription_plans')
          .select('id, name, price, billing_cycle')
          .eq('merchant_id', sub.merchant_id)
          .eq('is_active', true)
          .is('archived_at', null)
          .gt('price', plan.price)
          .order('price', { ascending: true })
          .limit(1)

        const higherPlan = (higherPlans?.[0] ?? null) as HigherPlanRow | null
        const resubscribeUrl = `https://substrack.work.gd/subscribe/${sub.plan_id}`
        const higherPlanUrl = higherPlan ? `https://substrack.work.gd/subscribe/${higherPlan.id}` : null

        await supabase.functions.invoke('send-email', {
          body: {
            to: sub.customer_email,
            from: `${merchant.business_name} <no-reply@substrack.work.gd>`,
            subject: `Your subscription has been cancelled`,
            html: resubscribeHtml(sub.customer_name, planName, merchant.business_name, resubscribeUrl, higherPlan, higherPlanUrl),
          },
        })

        cancelled++
        console.log('dunning-cron: dunning exhausted — subscriber cancelled:', sub.id)
      } else {
        console.warn('dunning-cron: unexpected dunning_step:', sub.dunning_step, 'for subscriber:', sub.id)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('dunning-cron error for subscriber:', sub.id, msg)
      errors++
    }
  }

  const summary = { processed: rows.length, advanced, cancelled, errors }
  console.log('dunning-cron complete:', JSON.stringify(summary))
  return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
