// supabase/functions/_shared/providers/stripe.ts

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import type { IPaymentProvider } from './interface.ts'
import type {
  Merchant,
  CreatePlanParams,
  CreatePlanResult,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  CancelSubscriptionParams,
  MigrateSubscriptionParams,
} from '../types.ts'
import type { NormalizedEvent } from '../normalizedEvents.ts'

export class StripeProvider implements IPaymentProvider {
  private stripe: Stripe
  private merchant: Merchant

  constructor(merchant: Merchant) {
    if (!merchant.stripe_api_key) {
      throw new Error('Stripe API key not configured for this merchant')
    }
    this.merchant = merchant
    this.stripe = new Stripe(merchant.stripe_api_key, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })
  }

  // ---------------------------------------------------------------------------
  // PLAN MANAGEMENT
  // ---------------------------------------------------------------------------

  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    const intervalMap: Record<string, { interval: 'day' | 'week' | 'month' | 'year'; interval_count: number }> = {
      daily:     { interval: 'day',   interval_count: 1 },
      weekly:    { interval: 'week',  interval_count: 1 },
      monthly:   { interval: 'month', interval_count: 1 },
      quarterly: { interval: 'month', interval_count: 3 },
      yearly:    { interval: 'year',  interval_count: 1 },
    }

    const billing = intervalMap[params.billingCycle]
    if (!billing) throw new Error(`Unsupported billing cycle: ${params.billingCycle}`)

    const product = await this.stripe.products.create({
      name: params.planName,
      description: params.planDescription ?? undefined,
    })

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(params.price * 100), // rupees → paise
      currency: params.currency.toLowerCase(),
      recurring: {
        interval: billing.interval,
        interval_count: billing.interval_count,
      },
    })

    return {
      stripeProductId: product.id,
      stripePriceId: price.id,
    }
  }

  async updatePlan(stripeProductId: string, planName: string, planDescription: string | null): Promise<void> {
    try {
      await this.stripe.products.update(stripeProductId, {
        name: planName,
        description: planDescription ?? undefined,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('No such product')) return
      throw err
    }
  }

  async archivePlan(stripePriceId: string): Promise<void> {
    try {
      const price = await this.stripe.prices.retrieve(stripePriceId)
      await this.stripe.prices.update(stripePriceId, { active: false })
      await this.stripe.products.update(price.product as string, { active: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      // If the price doesn't exist in Stripe, treat as already archived
      if (message.includes('No such price')) return
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION (CHECKOUT)
  // ---------------------------------------------------------------------------

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    if (!params.plan.stripe_price_id) {
      throw new Error(`Plan "${params.plan.name}" has not been synced to Stripe. Open Plans and re-save this plan.`)
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: params.plan.stripe_price_id, quantity: 1 }],
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        merchant_id: params.merchant.id,
        plan_id: params.plan.id,
        customer_name: params.customerName,
      },
      subscription_data: {
        metadata: {
          merchant_id: params.merchant.id,
          plan_id: params.plan.id,
          customer_name: params.customerName,
        },
      },
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { checkoutUrl: session.url }
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION MANAGEMENT
  // ---------------------------------------------------------------------------

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const subId = params.subscriber.provider_subscription_id
      ?? params.subscriber.stripe_subscription_id

    if (!subId) throw new Error('No subscription ID found for this subscriber')

    await this.stripe.subscriptions.cancel(subId)
  }

  async migrateSubscription(_params: MigrateSubscriptionParams): Promise<void> {
    throw new Error('migrateSubscription not yet implemented — Phase 4')
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK HANDLING
  // ---------------------------------------------------------------------------

  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      // Stripe signature format: t=timestamp,v1=hmac_sha256
      const parts = Object.fromEntries(
        signature.split(',').map(p => p.split('=') as [string, string])
      )
      const timestamp = parts['t']
      const v1 = parts['v1']
      if (!timestamp || !v1) return false

      // Reject webhooks older than 5 minutes to prevent replay attacks
      const tolerance = 300
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return false

      const signedPayload = `${timestamp}.${rawBody}`
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const sigBytes = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signedPayload),
      )
      const computed = Array.from(new Uint8Array(sigBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      return computed === v1
    } catch {
      return false
    }
  }

  async parseWebhookEvent(rawEvent: unknown): Promise<NormalizedEvent> {
    try {
      const event = rawEvent as Stripe.Event

      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          const meta = session.metadata as Record<string, string>

          if (!session.subscription) {
            return { type: 'unknown', provider: 'stripe', rawEventType: event.type }
          }

          const sub = await this.stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['latest_invoice'] }
          )

          const invoice = sub.latest_invoice as Stripe.Invoice | null
          const amount = invoice ? (invoice.amount_paid ?? 0) / 100 : 0
          const gatewayPaymentId = invoice?.id ?? ''

          return {
            type: 'subscription.activated',
            provider: 'stripe',
            merchantId: meta.merchant_id,
            planId: meta.plan_id,
            customerName: meta.customer_name ?? '',
            customerEmail: session.customer_email ?? '',
            providerSubscriptionId: sub.id,
            providerCustomerId: session.customer as string,
            amount,
            startDate: new Date(sub.current_period_start * 1000),
            nextRenewalDate: new Date(sub.current_period_end * 1000),
            gatewayPaymentId,
          }
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice
          const subId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id

          if (!subId) return { type: 'unknown', provider: 'stripe', rawEventType: event.type }

          // First payment is handled by checkout.session.completed
          if (invoice.billing_reason === 'subscription_create') {
            return { type: 'unknown', provider: 'stripe', rawEventType: 'invoice.payment_succeeded.first_payment' }
          }

          const sub = await this.stripe.subscriptions.retrieve(subId)

          return {
            type: 'payment.succeeded',
            provider: 'stripe',
            providerSubscriptionId: subId,
            amount: (invoice.amount_paid ?? 0) / 100,
            gatewayPaymentId: invoice.id,
            nextRenewalDate: new Date(sub.current_period_end * 1000),
          }
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          const subId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id

          if (!subId) return { type: 'unknown', provider: 'stripe', rawEventType: event.type }

          return {
            type: 'payment.failed',
            provider: 'stripe',
            providerSubscriptionId: subId,
            amount: (invoice.amount_due ?? 0) / 100,
            reason: invoice.last_finalization_error?.message ?? 'Payment failed',
          }
        }

        case 'payment_intent.processing': {
          const pi = event.data.object as Stripe.PaymentIntent
          // payment_intent doesn't carry subscription ID directly —
          // the handler looks it up in the DB via gatewayPaymentId
          return {
            type: 'payment.processing',
            provider: 'stripe',
            providerSubscriptionId: pi.id, // handler will resolve to actual sub ID
          }
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription
          return {
            type: 'subscription.cancelled',
            provider: 'stripe',
            providerSubscriptionId: sub.id,
          }
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription
          return {
            type: 'subscription.updated',
            provider: 'stripe',
            providerSubscriptionId: sub.id,
            nextRenewalDate: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          }
        }

        default:
          return { type: 'unknown', provider: 'stripe', rawEventType: event.type }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('StripeProvider.parseWebhookEvent error:', message)
      return { type: 'unknown', provider: 'stripe', rawEventType: 'parse_error' }
    }
  }
}