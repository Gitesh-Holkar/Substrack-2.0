// supabase/functions/stripe-webhook/index.ts
//
// Receives Stripe webhook events, verifies signature,
// parses into NormalizedEvent, delegates to shared handlers.
//
// All business logic (subscriber creation, payments, emails, PDF)
// lives in _shared/subscriptionHandlers.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider } from '../_shared/providers/index.ts'
import { handleNormalizedEvent } from '../_shared/subscriptionHandlers.ts'
import type { Merchant } from '../_shared/types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('No Stripe signature provided')
    return new Response('No signature', { status: 400 })
  }

  let body: string
  let parsedBody: Record<string, unknown>

  try {
    body = await req.text()
    parsedBody = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  console.log('Stripe event type:', parsedBody.type)

  // ---------------------------------------------------------------------------
  // Resolve merchant_id from the webhook payload.
  // Stripe embeds merchant_id in metadata on both the session and subscription.
  // Falls back to DB lookup via stripe_subscription_id for invoice events.
  // ---------------------------------------------------------------------------
  let merchantId: string | null = null

  const obj = (parsedBody.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined

  // Checkout session / subscription metadata
  merchantId = (obj?.metadata as Record<string, string> | undefined)?.merchant_id ?? null

  // subscription_data.metadata on checkout sessions
  if (!merchantId) {
    const subDataMeta = (obj?.subscription_data as Record<string, unknown> | undefined)?.metadata as Record<string, string> | undefined
    merchantId = subDataMeta?.merchant_id ?? null
  }

  // Invoice line item metadata
  if (!merchantId) {
    const lines = (obj?.lines as Record<string, unknown> | undefined)?.data as Record<string, unknown>[] | undefined
    merchantId = (lines?.[0]?.metadata as Record<string, string> | undefined)?.merchant_id ?? null
  }

  // Fall back: look up by stripe_subscription_id in DB
  if (!merchantId) {
    const subscriptionId = obj?.subscription as string | undefined
    if (subscriptionId) {
      const { data: subscriber } = await supabase
        .from('subscribers')
        .select('merchant_id')
        .eq('stripe_subscription_id', subscriptionId)
        .limit(1)
        .single()

      if (subscriber) merchantId = subscriber.merchant_id
    }
  }

  if (!merchantId) {
    console.error('No merchant_id found in Stripe webhook')
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  // ---------------------------------------------------------------------------
  // Fetch full merchant row
  // ---------------------------------------------------------------------------
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

  if (merchantError || !merchant?.stripe_api_key) {
    console.error('Merchant not found or Stripe key missing:', merchantId)
    return new Response('Merchant not found', { status: 400 })
  }

  if (!merchant.stripe_webhook_secret) {
    console.error('Stripe webhook secret not configured:', merchantId)
    return new Response('Webhook secret not configured', { status: 400 })
  }

  // ---------------------------------------------------------------------------
  // Verify signature
  // ---------------------------------------------------------------------------
  const provider = getProvider(merchant as Merchant)

  const isValid = await provider.verifyWebhookSignature(
    body,
    signature,
    merchant.stripe_webhook_secret,
  )

  if (!isValid) {
    console.error('Invalid Stripe webhook signature for merchant:', merchantId)
    return new Response('Invalid signature', { status: 400 })
  }

  // ---------------------------------------------------------------------------
  // Parse and handle
  // ---------------------------------------------------------------------------
  try {
    const normalizedEvent = await provider.parseWebhookEvent(parsedBody)
    console.log('Normalized event:', normalizedEvent.type)
    await handleNormalizedEvent(normalizedEvent, merchant as Merchant, supabase)

    // Legacy Stripe safety: customer.subscription.deleted historically cancelled
    // rows directly in this function. The shared normalized handler now owns that
    // logic, but we still sync cancelled_at on the legacy Stripe column so older
    // rows remain consistent when Stripe sends a deletion event.
    if (parsedBody.type === 'customer.subscription.deleted' && typeof obj?.id === 'string') {
      await supabase
        .from('subscribers')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', obj.id)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error handling Stripe event:', message)
    return new Response(JSON.stringify({ received: true, error: message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
