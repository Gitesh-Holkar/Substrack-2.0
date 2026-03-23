// supabase/functions/_shared/providers/cashfree.ts
//
// Cashfree Subscription API v2025-01-01
// Docs: https://www.cashfree.com/docs/api-reference/payments/latest/subscription
//
// Key difference from Stripe:
//   Cashfree has no separate "create plan" step. Plan details are embedded
//   inline when creating a subscription. createPlan() is a no-op here.

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

const CASHFREE_API_VERSION = '2025-01-01'

// Calculates subscription_first_charge_time based on plan billing settings.
// - prepaid, no trial  -> charge fires the moment mandate activates (set to past)
// - trial period set   -> charge fires after trial ends
// - postpaid           -> charge fires at end of first billing cycle
function getFirstChargeTime(
  billingType: 'prepaid' | 'postpaid',
  trialPeriodDays: number,
  billingCycle: string,
): string {
  const now = Date.now()

  if (trialPeriodDays > 0) {
    // Trial: first charge after trial ends
    const trialMs = trialPeriodDays * 24 * 60 * 60 * 1000
    return formatCashfreeDateTime(new Date(now + trialMs))
  }

  if (billingType === 'postpaid') {
    // Postpaid: charge at end of first billing cycle
    const cycleDays: Record<string, number> = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    }
    const days = cycleDays[billingCycle] ?? 30
    return formatCashfreeDateTime(new Date(now + days * 24 * 60 * 60 * 1000))
  }

// Prepaid: authorization_amount = full plan price (IS the first payment).
  // subscription_first_charge_time = one full billing cycle from now (second payment).
  const cycleDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  }
  const days = cycleDays[billingCycle] ?? 30
  return formatCashfreeDateTime(new Date(now + days * 24 * 60 * 60 * 1000))
}

// Cashfree datetime format: "YYYY-MM-DD HH:MM:SS"
function formatCashfreeDateTime(date: Date): string {
  // Cashfree requires ISO8601 format: 2021-07-02T10:20:12Z
  return date.toISOString().split('.')[0] + 'Z'
}

export class CashfreeProvider implements IPaymentProvider {
  private appId: string
  private secretKey: string
  private baseUrl: string

  constructor(merchant: Merchant) {
    if (!merchant.cashfree_app_id || !merchant.cashfree_secret_key) {
      throw new Error('Cashfree credentials not configured for this merchant')
    }
    this.appId = merchant.cashfree_app_id
    this.secretKey = merchant.cashfree_secret_key
    // Detect sandbox vs live by key prefix - sandbox keys start with TEST
    this.baseUrl = merchant.cashfree_app_id.startsWith('TEST')
      ? 'https://sandbox.cashfree.com'
      : 'https://api.cashfree.com'
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.appId,
      'x-client-secret': this.secretKey,
      'x-api-version': CASHFREE_API_VERSION,
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()

    if (!res.ok) {
      const message = data?.message ?? data?.error ?? `Cashfree API error ${res.status}`
      throw new Error(message)
    }

    return data as T
  }

  // ---------------------------------------------------------------------------
  // PLAN MANAGEMENT
  // Cashfree embeds plan details inline in each subscription - no separate
  // plan registry exists in their API. We return the Substrack planId as
  // cashfreePlanId so it's stored in the DB for reference.
  // ---------------------------------------------------------------------------

  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    // No API call needed - plan details are sent at subscription creation time.
    return { cashfreePlanId: params.planId }
  }

  async updatePlan(_planId: string, _planName: string, _planDescription: string | null): Promise<void> {
    // No-op - Cashfree has no plan registry. Name/description live in Substrack DB only.
  }

  async archivePlan(_planId: string): Promise<void> {
    // No-op - Cashfree has no plan registry to deactivate.
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION (CHECKOUT)
  // ---------------------------------------------------------------------------

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const { plan, merchant, customerName, customerEmail, customerPhone, successUrl } = params

    if (!customerPhone) {
      throw new Error('Phone number is required for Cashfree subscriptions (UPI mandate requirement)')
    }

    const intervalMap: Record<string, { type: string; intervals: number }> = {
      daily:     { type: 'DAY',   intervals: 1 },
      weekly:    { type: 'WEEK',  intervals: 1 },
      monthly:   { type: 'MONTH', intervals: 1 },
      quarterly: { type: 'MONTH', intervals: 3 },
      yearly:    { type: 'YEAR',  intervals: 1 },
    }

    const billing = intervalMap[plan.billing_cycle]
    if (!billing) throw new Error(`Unsupported billing cycle: ${plan.billing_cycle}`)

    // Unique subscription ID: merchantId + planId + timestamp
    const subscriptionId = `sub_${merchant.id.slice(0, 8)}_${plan.id.slice(0, 8)}_${Date.now()}`

    const body = {
      subscription_id: subscriptionId,
      customer_details: {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      plan_details: {
        plan_name: plan.name,
        plan_type: 'PERIODIC',
        plan_amount: plan.price,
        plan_max_amount: plan.price,
        plan_currency: plan.currency,
        plan_interval_type: billing.type,
        plan_intervals: billing.intervals,
        plan_note: plan.description ?? plan.name,
      },
      authorization_details: {
        // Prepaid (no trial): charge full plan price at authorization.
        // Customer's UPI PIN entry IS the first payment - same as JioCinema/Codex.
        // Trial/Postpaid: charge Rs1 and refund - customer pays nothing at signup.
        authorization_amount: (plan.trial_period_days ?? 0) > 0 || plan.billing_type === 'postpaid'
          ? 1
          : plan.price,
        authorization_amount_refund: (plan.trial_period_days ?? 0) > 0 || plan.billing_type === 'postpaid',
        payment_methods: ['upi', 'card', 'enach'],
      },
      subscription_first_charge_time: getFirstChargeTime(
        plan.billing_type ?? 'prepaid',
        plan.trial_period_days ?? 0,
        plan.billing_cycle,
      ),
      subscription_meta: {
        return_url: successUrl,
        // Embed Substrack IDs in tags so webhooks can route correctly
        subscription_tags: {
          merchant_id: merchant.id,
          plan_id: plan.id,
        },
      },
    }

    const data = await this.request<{
      cf_subscription_id: string
      subscription_session_id?: string
      authorisation_details?: { authorization_url?: string }
      authorization_details?: { authorization_url?: string }
    }>('POST', '/pg/subscriptions', body)

    const sessionId = data.subscription_session_id

    if (!sessionId) {
      throw new Error('Cashfree did not return a subscription session ID')
    }

    const checkoutUrl = this.baseUrl.includes('sandbox')
      ? `https://payments-test.cashfree.com/subscriptions/?subscription_session_id=${sessionId}`
      : `https://payments.cashfree.com/subscriptions/?subscription_session_id=${sessionId}`

    return {
      checkoutUrl,
      providerSubscriptionId: data.cf_subscription_id,
      cashfreeSessionId: sessionId,
      isSandbox: this.baseUrl.includes('sandbox'),
    }
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION MANAGEMENT
  // ---------------------------------------------------------------------------

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const subId = params.subscriber.provider_subscription_id
      ?? params.subscriber.stripe_subscription_id

    if (!subId) throw new Error('No subscription ID found for this subscriber')

    await this.request('PATCH', `/pg/subscriptions/${subId}`, {
      subscription_status: 'CANCELLED',
    })
  }

  async migrateSubscription(_params: MigrateSubscriptionParams): Promise<void> {
    throw new Error('migrateSubscription not yet implemented - Phase 4')
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK HANDLING
  // ---------------------------------------------------------------------------

  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
    timestamp?: string,
  ): Promise<boolean> {
    try {
      // Cashfree official algorithm:
      // signedPayload = timestamp + rawBody (simple concatenation, no separator)
      // signature = Base64(HMAC-SHA256(signedPayload, clientSecret))
      const signedPayload = (timestamp ?? '') + rawBody

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

      // Base64 output - NOT hex
      const computed = btoa(
        String.fromCharCode(...new Uint8Array(sigBytes))
      )

      return computed === signature
    } catch {
      return false
    }
  }

  async parseWebhookEvent(rawEvent: unknown): Promise<NormalizedEvent> {
    try {
      const event = rawEvent as {
        type: string
        event_time: string
        data: Record<string, unknown>
      }

      switch (event.type) {

        case 'SUBSCRIPTION_STATUS_CHANGED': {
          const data = event.data as {
            subscription_details: {
              cf_subscription_id: string
              subscription_id: string
              subscription_status: string
            }
            customer_details: {
              customer_name: string | null
              customer_email: string
            }
            plan_details: {
              plan_recurring_amount: number | null
              plan_max_amount: number | null
              next_schedule_date?: string | null
            }
            subscription_tags?: Record<string, string>
          }

          const status = data.subscription_details.subscription_status
          const subId = data.subscription_details.cf_subscription_id
          const tags = data.subscription_details as unknown as Record<string, unknown>
          // Tags are in subscription_meta - Cashfree echoes them back
          const merchantId = (tags.merchant_id as string) ?? ''
          const planId = (tags.plan_id as string) ?? ''

          if (status === 'ACTIVE') {
            const amount =
              data.plan_details.plan_recurring_amount ??
              data.plan_details.plan_max_amount ??
              0

            const nextRenewal = data.plan_details.next_schedule_date
              ? new Date(data.plan_details.next_schedule_date)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // fallback: +30 days

            return {
              type: 'subscription.activated',
              provider: 'cashfree',
              merchantId,
              planId,
              customerName: data.customer_details.customer_name ?? '',
              customerEmail: data.customer_details.customer_email,
              providerSubscriptionId: subId,
              providerCustomerId: subId, // Cashfree has no separate customer ID
              amount,
              startDate: new Date(event.event_time),
              nextRenewalDate: nextRenewal,
              gatewayPaymentId: subId,
            }
          }

          if (
            status === 'CANCELLED' ||
            status === 'CUSTOMER_CANCELLED' ||
            status === 'EXPIRED' ||
            status === 'COMPLETED'
          ) {
            return {
              type: 'subscription.cancelled',
              provider: 'cashfree',
              providerSubscriptionId: subId,
            }
          }

          // ON_HOLD, BANK_APPROVAL_PENDING, etc. - not actionable yet
          return { type: 'unknown', provider: 'cashfree', rawEventType: `${event.type}:${status}` }
        }

        case 'SUBSCRIPTION_PAYMENT_SUCCESS': {
          const data = event.data as {
            cf_subscription_id: string
            cf_payment_id: string | number
            payment_amount: number
            next_schedule_date?: string | null
          }

          return {
            type: 'payment.succeeded',
            provider: 'cashfree',
            providerSubscriptionId: String(data.cf_subscription_id),
            amount: data.payment_amount,
            gatewayPaymentId: String(data.cf_payment_id),
            nextRenewalDate: data.next_schedule_date
              ? new Date(data.next_schedule_date)
              : null,
          }
        }

        case 'SUBSCRIPTION_PAYMENT_FAILED': {
          const data = event.data as {
            cf_subscription_id: string
            payment_amount: number
            failure_details?: { reason?: string }
          }

          return {
            type: 'payment.failed',
            provider: 'cashfree',
            providerSubscriptionId: String(data.cf_subscription_id),
            amount: data.payment_amount,
            reason: data.failure_details?.reason ?? 'Payment failed',
          }
        }

        case 'SUBSCRIPTION_PAYMENT_CANCELLED': {
          // Treat cancelled payment same as failed for dunning purposes
          const data = event.data as {
            cf_subscription_id: string
            payment_amount: number
          }

          return {
            type: 'payment.failed',
            provider: 'cashfree',
            providerSubscriptionId: String(data.cf_subscription_id),
            amount: data.payment_amount,
            reason: 'Payment cancelled by customer',
          }
        }

        default:
          return { type: 'unknown', provider: 'cashfree', rawEventType: event.type }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('CashfreeProvider.parseWebhookEvent error:', message)
      return { type: 'unknown', provider: 'cashfree', rawEventType: 'parse_error' }
    }
  }
}
