// supabase/functions/manage-plan/index.ts
//
// Replaces manage-stripe-plan. Works for both Stripe and Cashfree.
// Called from: services/paymentService.ts
//
// Actions:
//   create  — register plan with gateway, store gateway IDs in DB
//   update  — update plan name/description in gateway + DB
//   archive — deactivate plan in gateway, set is_active=false in DB

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider } from '../_shared/providers/index.ts'
import type { Merchant } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id, email, full_name, business_name, business_address, gst_number,
        logo_url, phone, redirect_url, widget_id, plan_tier,
        payment_provider,
        stripe_api_key, stripe_publishable_key, stripe_webhook_secret,
        cashfree_app_id, cashfree_secret_key, cashfree_webhook_secret
      `)
      .eq('id', user.id)
      .single()

    if (merchantError || !merchant) throw new Error('Merchant not found')

    const body = await req.json()
    const { action } = body
    const provider = getProvider(merchant as Merchant)

    switch (action) {

      case 'create': {
        const { planId, planName, planDescription, price, currency, billingCycle } = body

        if (!planId || !planName || !price || !billingCycle) {
          throw new Error('Missing required fields: planId, planName, price, billingCycle')
        }

        const result = await provider.createPlan({
          planId,
          planName,
          planDescription: planDescription ?? null,
          price: Number(price),
          currency: currency ?? 'INR',
          billingCycle,
          merchant: merchant as Merchant,
        })

        const updates: Record<string, string> = {}
        if (result.stripeProductId) updates.stripe_product_id = result.stripeProductId
        if (result.stripePriceId)   updates.stripe_price_id   = result.stripePriceId
        if (result.cashfreePlanId)  updates.cashfree_plan_id  = result.cashfreePlanId

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('subscription_plans')
            .update(updates)
            .eq('id', planId)
            .eq('merchant_id', user.id)

          if (updateError) {
            throw new Error('Plan created in gateway but failed to save IDs: ' + updateError.message)
          }
        }

        return okJson({ success: true, ...result })
      }

      case 'update': {
        const { planId, planName, planDescription } = body

        if (!planId || !planName) throw new Error('Missing required fields: planId, planName')

        // Fetch gateway IDs needed for Stripe sync
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('stripe_product_id')
          .eq('id', planId)
          .eq('merchant_id', user.id)
          .single()

        // Stripe: updates product name/description in Stripe dashboard
        // Cashfree: no-op (plan details are local only)
        const gatewayId = plan?.stripe_product_id ?? ''
        await provider.updatePlan(gatewayId, planName, planDescription ?? null)

        const { error: updateError } = await supabase
          .from('subscription_plans')
          .update({ name: planName, description: planDescription ?? null })
          .eq('id', planId)
          .eq('merchant_id', user.id)

        if (updateError) throw new Error('Failed to update plan: ' + updateError.message)

        return okJson({ success: true })
      }

      case 'archive': {
        const { planId } = body
        if (!planId) throw new Error('Missing required field: planId')

        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('stripe_price_id, cashfree_plan_id')
          .eq('id', planId)
          .eq('merchant_id', user.id)
          .single()

        if (!plan) throw new Error('Plan not found')

        // Gateway ID to deactivate — price ID for Stripe, plan ID for Cashfree
        const gatewayPlanId = merchant.payment_provider === 'stripe'
          ? plan.stripe_price_id
          : plan.cashfree_plan_id

        if (gatewayPlanId) {
          await provider.archivePlan(gatewayPlanId)
        }

        const { error: updateError } = await supabase
          .from('subscription_plans')
          .update({ is_active: false, archived_at: new Date().toISOString() })
          .eq('id', planId)
          .eq('merchant_id', user.id)

        if (updateError) throw new Error('Failed to archive plan: ' + updateError.message)

        return okJson({ success: true })
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('manage-plan error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})

function okJson(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  )
}
