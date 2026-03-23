
// Receives webhook events from Cashfree, verifies signature,
// parses into NormalizedEvent, delegates to shared handlers.
//
// Cashfree webhook signature header: x-webhook-signature
// Signature: Base64(HMAC-SHA256(timestamp + raw body, merchant's cashfree_secret_key))

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
  const signature = req.headers.get('x-webhook-signature')
  const timestamp = req.headers.get('x-webhook-timestamp') ?? ''

  if (!signature) {
    console.error('No Cashfree signature provided')
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

  console.log('Cashfree event type:', parsedBody.type)

  // ---------------------------------------------------------------------------
  // Resolve merchant_id from the webhook payload.
  // Cashfree embeds subscription_tags in the payload which contains our IDs.
  // Fall back to DB lookup via cf_subscription_id if tags are missing.
  // ---------------------------------------------------------------------------
  let merchantId: string | null = null
  let fallbackPlanId: string | null = null

  const data = parsedBody.data as Record<string, unknown> | undefined

  // Try subscription_tags first (set during createSubscription)
  const tags = (data?.subscription_details as Record<string, unknown>)?.subscription_tags as Record<string, string> | undefined
  if (tags?.merchant_id) {
    merchantId = tags.merchant_id
  }

 // Fall back: look up by cf_subscription_id in our DB.
  // Location differs by event type:
  //   SUBSCRIPTION_STATUS_CHANGED → data.subscription_details.cf_subscription_id
  //   SUBSCRIPTION_PAYMENT_SUCCESS/FAILED/CANCELLED → data.cf_subscription_id
  if (!merchantId) {
    const subDetails = data?.subscription_details as Record<string, unknown> | undefined
    const cfSubId = (
      subDetails?.cf_subscription_id ??
      data?.cf_subscription_id
    ) as string | undefined

    if (cfSubId) {
      console.log('Fallback lookup for cf_subscription_id:', cfSubId)
      const { data: subscriber } = await supabase
        .from('subscribers')
        .select('merchant_id, plan_id')
        .eq('provider_subscription_id', String(cfSubId))
        .limit(1)
        .single()

      if (subscriber) {
        merchantId = subscriber.merchant_id
        fallbackPlanId = subscriber.plan_id
      }
    }
  }

  if (!merchantId) {
    console.error('No merchant_id found in Cashfree webhook')
    // Return 200 to prevent Cashfree from retrying unresolvable events
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  // ---------------------------------------------------------------------------
  // Fetch merchant
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

  if (merchantError || !merchant) {
    console.error('Merchant not found:', merchantId)
    return new Response('Merchant not found', { status: 400 })
  }

  if (!merchant.cashfree_secret_key) {
    console.error('Cashfree secret key not configured for merchant:', merchantId)
    return new Response('Cashfree not configured', { status: 400 })
  }

  // ---------------------------------------------------------------------------
  // Verify signature
  // ---------------------------------------------------------------------------
  const provider = getProvider(merchant as Merchant)
  const isValid = await provider.verifyWebhookSignature(
    body,
    signature,
    merchant.cashfree_secret_key!,
    timestamp,
  )

  if (!isValid) {
    console.error('Invalid Cashfree webhook signature for merchant:', merchantId)
    return new Response('Invalid signature', { status: 400 })
  }

  // ---------------------------------------------------------------------------
  // Parse and handle
  // ---------------------------------------------------------------------------
  try {
    let normalizedEvent = await provider.parseWebhookEvent(parsedBody)
    console.log('Normalized event:', normalizedEvent.type)

    // When Cashfree returns null subscription_tags, merchantId/planId are empty strings.
    // Override them with values from the pending subscriber row we stored earlier.
    if (
      normalizedEvent.type === 'subscription.activated' &&
      (!normalizedEvent.merchantId || !normalizedEvent.planId)
    ) {
      normalizedEvent = {
        ...normalizedEvent,
        merchantId: normalizedEvent.merchantId || merchantId || '',
        planId: normalizedEvent.planId || fallbackPlanId || '',
      }
    }

    await handleNormalizedEvent(normalizedEvent, merchant as Merchant, supabase)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error handling Cashfree event:', message)
    // Still return 200 — event was received, internal error should not trigger retry
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
