
// Replaces create-checkout. Works for both Stripe and Cashfree.
// Called from: app/(public)/subscribe/[planId]/page.tsx
//
// Request body:
//   planId        string   — Substrack plan UUID
//   merchantId    string   — Substrack merchant UUID
//   customerName  string
//   customerEmail string
//   customerPhone string?  — required for Cashfree, ignored by Stripe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider } from '../_shared/providers/index.ts'
import type { Merchant, SubscriptionPlan } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId, merchantId, customerName, customerEmail, customerPhone } = await req.json()

    if (!planId || !merchantId || !customerName || !customerEmail) {
      throw new Error('Missing required fields: planId, merchantId, customerName, customerEmail')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id, email, full_name, business_name, business_address, gst_number,
        logo_url, phone, redirect_url, widget_id, plan_tier,
        payment_provider,
        stripe_api_key, stripe_publishable_key, stripe_webhook_secret,
        cashfree_app_id, cashfree_secret_key, cashfree_webhook_secret
      `)
      .eq('id', merchantId)
      .single()

    if (merchantError || !merchant) {
      throw new Error('Merchant not found')
    }

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, merchant_id, name, description, price, currency, billing_cycle, features, is_active, subscriber_count, stripe_product_id, stripe_price_id, cashfree_plan_id, trial_period_days, billing_type')
      .eq('id', planId)
      .eq('merchant_id', merchantId)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found')
    }

    if (!plan.is_active) {
      throw new Error('This plan is no longer accepting new subscribers')
    }

    // Validate Cashfree phone requirement before calling provider
    if (merchant.payment_provider === 'cashfree' && !customerPhone) {
      throw new Error('Phone number is required for this payment gateway')
    }

    const origin = req.headers.get('origin') ?? 'https://substrack.work.gd'

    const successUrl = merchant.redirect_url
      ? `${merchant.redirect_url}?substrack_session=success`
      : `${origin}/subscription-success?merchant=${encodeURIComponent(merchant.business_name)}`

    const cancelUrl = merchant.redirect_url
      ? `${merchant.redirect_url}?cancelled=true`
      : `${origin}/subscription-cancelled`

    const provider = getProvider(merchant as Merchant)

    const result = await provider.createSubscription({
      plan: plan as SubscriptionPlan,
      merchant: merchant as Merchant,
      customerName,
      customerEmail,
      customerPhone,
      successUrl,
      cancelUrl,
    })

    console.log(`Checkout created via ${merchant.payment_provider} for plan: ${plan.name}`)

    // For Cashfree: store a pending subscriber row immediately so that when the
    // webhook fires, we can resolve merchant_id and plan_id even if subscription_tags
    // are null (which Cashfree does not reliably echo back in webhook payloads).
    if (merchant.payment_provider === 'cashfree' && result.providerSubscriptionId) {
      await supabase.from('subscribers').insert({
        merchant_id: merchantId,
        plan_id: planId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: 'pending',
        payment_provider: 'cashfree',
        provider_subscription_id: result.providerSubscriptionId,
        start_date: new Date().toISOString(),
      })
      console.log('Pending Cashfree subscriber stored:', result.providerSubscriptionId)
    }

    return new Response(
      JSON.stringify({
        url: result.checkoutUrl,
        cashfreeSessionId: result.cashfreeSessionId,
        isSandbox: result.isSandbox ?? true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('create-subscription error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
