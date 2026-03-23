// supabase/functions/_shared/normalizedEvents.ts
//
// Every payment gateway fires different webhook event names with different
// payload shapes. This file defines Substrack's own universal event format.
//
// How it works:
//   1. A raw webhook arrives at stripe-webhook or cashfree-webhook
//   2. The provider's parseWebhookEvent() translates it into a NormalizedEvent
//   3. handleNormalizedEvent() in subscriptionHandlers.ts processes it
//   4. The handler never knows or cares which gateway fired the event
//
// Adding a new gateway in future = write a new provider that outputs
// NormalizedEvent. Nothing in subscriptionHandlers.ts changes.
//
// Import with: import type { NormalizedEvent } from '../_shared/normalizedEvents.ts'

import type { PaymentProvider } from './types.ts'

// -----------------------------------------------------------------------------
// NormalizedEvent
// A discriminated union — every event type has a unique `type` string.
// The handler switches on `type` to know what data is available.
// -----------------------------------------------------------------------------
export type NormalizedEvent =
  // Subscription was successfully created and first payment collected.
  // Fired after: Stripe checkout.session.completed / Cashfree SUBSCRIPTION_ACTIVATED
  | {
      type: 'subscription.activated'
      provider: PaymentProvider
      merchantId: string            // Substrack merchant UUID
      planId: string                // Substrack plan UUID
      customerName: string
      customerEmail: string
      providerSubscriptionId: string  // Stripe sub ID or Cashfree sub ID
      providerCustomerId: string      // Stripe customer ID or Cashfree customer ID
      amount: number                  // INR rupees
      startDate: Date
      nextRenewalDate: Date
      gatewayPaymentId: string        // Stripe invoice ID or Cashfree payment ID
    }

  // A recurring payment succeeded (renewal, not first payment).
  // Fired after: Stripe invoice.payment_succeeded / Cashfree SUBSCRIPTION_PAYMENT_SUCCESS
  | {
      type: 'payment.succeeded'
      provider: PaymentProvider
      providerSubscriptionId: string
      amount: number
      gatewayPaymentId: string
      nextRenewalDate: Date | null
    }

  // A payment failed (card declined, UPI failed, insufficient funds, etc.)
  // Fired after: Stripe invoice.payment_failed / Cashfree SUBSCRIPTION_PAYMENT_FAILED
  | {
      type: 'payment.failed'
      provider: PaymentProvider
      providerSubscriptionId: string
      amount: number
      reason: string               // human-readable failure reason
    }

  // Payment is in processing state — UPI 24-hour pre-debit notification window.
  // Fired after: Stripe payment_intent.processing
  // Cashfree does not fire this — UPI on Cashfree resolves synchronously.
  | {
      type: 'payment.processing'
      provider: PaymentProvider
      providerSubscriptionId: string
    }

  // Subscription was cancelled — by customer, merchant, or after dunning exhausted.
  // Fired after: Stripe customer.subscription.deleted / Cashfree SUBSCRIPTION_CANCELLED
  | {
      type: 'subscription.cancelled'
      provider: PaymentProvider
      providerSubscriptionId: string
    }

  // Subscription details updated — renewal date changed, plan changed, etc.
  // Fired after: Stripe customer.subscription.updated / Cashfree SUBSCRIPTION_UPDATED
  | {
      type: 'subscription.updated'
      provider: PaymentProvider
      providerSubscriptionId: string
      nextRenewalDate: Date | null
    }

  // Gateway sent an event we don't handle — log and ignore.
  // Both providers will produce this for events outside our list.
  | {
      type: 'unknown'
      provider: PaymentProvider
      rawEventType: string   // original event name from the gateway, for logging
    }


// -----------------------------------------------------------------------------
// Type guard helpers
// Use these in subscriptionHandlers.ts to narrow the union safely.
// -----------------------------------------------------------------------------

export function isActivated(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'subscription.activated' }> {
  return e.type === 'subscription.activated'
}

export function isPaymentSucceeded(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'payment.succeeded' }> {
  return e.type === 'payment.succeeded'
}

export function isPaymentFailed(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'payment.failed' }> {
  return e.type === 'payment.failed'
}

export function isPaymentProcessing(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'payment.processing' }> {
  return e.type === 'payment.processing'
}

export function isCancelled(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'subscription.cancelled' }> {
  return e.type === 'subscription.cancelled'
}

export function isUpdated(e: NormalizedEvent): e is Extract<NormalizedEvent, { type: 'subscription.updated' }> {
  return e.type === 'subscription.updated'
}