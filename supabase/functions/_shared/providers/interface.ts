// supabase/functions/_shared/providers/interface.ts

import type {
  CreatePlanParams,
  CreatePlanResult,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  CancelSubscriptionParams,
  MigrateSubscriptionParams,
} from '../types.ts'

import type { NormalizedEvent } from '../normalizedEvents.ts'

export interface IPaymentProvider {
  createPlan(params: CreatePlanParams): Promise<CreatePlanResult>

  // name/description only — price and billing cycle are immutable after creation.
  // Cashfree is local-only, no API call needed.
  updatePlan(planId: string, planName: string, planDescription: string | null): Promise<void>

  // Must not throw if plan doesn't exist in gateway — handle gracefully.
  // planId is the gateway's own plan/price ID, not Substrack's UUID.
  archivePlan(planId: string): Promise<void>

  createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult>

  cancelSubscription(params: CancelSubscriptionParams): Promise<void>

  // Phase 4. Stub with `throw new Error('Not yet implemented')` for now.
  // Change takes effect at next billing cycle — never prorate.
  migrateSubscription(params: MigrateSubscriptionParams): Promise<void>

  // Async because Stripe uses SubtleCrypto, Cashfree uses HMAC — both async.
  // Never throws — return false on any error.
  verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
    timestamp?: string,
  ): Promise<boolean>

  // Async because Stripe requires an API call to fetch subscription details
  // (renewal dates, amounts) not present in the raw webhook payload.
  // Returns { type: 'unknown' } for unhandled events — never throws.
  parseWebhookEvent(rawEvent: unknown): Promise<NormalizedEvent>
}
