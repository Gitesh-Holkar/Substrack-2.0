
// Shared types used across ALL edge functions.
// Import with: import type { Merchant, ... } from '../_shared/types.ts'
//
// Rules:
//   - No gateway-specific types here. Gateway types live in their provider files.
//   - Every field maps 1:1 to an actual DB column. No invented fields.
//   - Money values are numbers (INR rupees as stored in DB). Never strings.

// -----------------------------------------------------------------------------
// Payment provider identifier
// Extend this union when adding a new gateway.
// -----------------------------------------------------------------------------
export type PaymentProvider = 'stripe' | 'cashfree'

// -----------------------------------------------------------------------------
// Merchant
// Full merchant row — only used inside edge functions (server-side).
// Never send stripe_api_key or cashfree_secret_key to the client.
// -----------------------------------------------------------------------------
export interface Merchant {
  id: string
  email: string
  full_name: string
  business_name: string
  business_address: string | null
  gst_number: string | null
  logo_url: string | null
  phone: string | null
  redirect_url: string | null
  widget_id: string | null
  plan_tier: 'free' | 'starter' | 'pro' | 'enterprise'

  // Payment provider selection
  payment_provider: PaymentProvider

  // Stripe credentials (existing columns — never remove)
  stripe_api_key: string | null
  stripe_publishable_key: string | null
  stripe_webhook_secret: string | null

  // Cashfree credentials (new columns from migration)
  cashfree_app_id: string | null
  cashfree_secret_key: string | null
  cashfree_webhook_secret: string | null

  created_at: string
  updated_at: string
}

// Safe public subset — used on public pages, never includes credentials
export interface PublicMerchant {
  id: string
  business_name: string
  email: string
  logo_url: string | null
  redirect_url: string | null
}

// -----------------------------------------------------------------------------
// SubscriptionPlan
// -----------------------------------------------------------------------------
export interface SubscriptionPlan {
  id: string
  merchant_id: string
  name: string
  description: string | null
  price: number
  currency: string
  billing_cycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  features: string[]
  is_active: boolean
  subscriber_count: number
  trial_period_days: number
  billing_type: 'prepaid' | 'postpaid'

  // Stripe IDs (existing columns — never remove)
  stripe_product_id: string | null
  stripe_price_id: string | null

  // Cashfree ID (new column from migration)
  cashfree_plan_id: string | null
  archived_at: string | null

  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Subscriber
// -----------------------------------------------------------------------------
export interface Subscriber {
  id: string
  merchant_id: string
  plan_id: string
  customer_name: string
  customer_email: string
  status: 'active' | 'cancelled' | 'failed' | 'past_due' | 'pending'

  // Dates
  start_date: string
  next_renewal_date: string | null
  last_payment_date: string | null
  last_payment_amount: number | null

  // Which gateway this subscriber uses
  payment_provider: PaymentProvider

  // Unified provider fields (new columns from migration)
  // These are the canonical fields for all new code.
  provider_subscription_id: string | null
  provider_customer_id: string | null

  // Stripe-specific fields (existing columns — never remove)
  // Kept for backwards compatibility with existing Stripe subscribers.
  stripe_subscription_id: string | null
  stripe_customer_id: string | null

  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// PaymentTransaction
// -----------------------------------------------------------------------------
export interface PaymentTransaction {
  id: string
  merchant_id: string
  subscriber_id: string
  plan_id: string
  amount: number
  status: 'success' | 'failed' | 'pending'

  // Which gateway processed this transaction
  payment_provider: PaymentProvider

  // Unified provider field (new column from migration)
  provider_payment_id: string | null

  // Stripe-specific field (existing column — never remove)
  stripe_payment_id: string | null

  payment_date: string
  created_at: string
}

// -----------------------------------------------------------------------------
// CreatePlanParams
// What the manage-plan function sends to a provider's createPlan()
// -----------------------------------------------------------------------------
export interface CreatePlanParams {
  planId: string           // Substrack's own plan UUID
  planName: string
  planDescription: string | null
  price: number            // in INR rupees (not paise, not cents)
  currency: string         // 'INR'
  billingCycle: SubscriptionPlan['billing_cycle']
  merchant: Merchant
}

export interface CreatePlanResult {
  // Provider-specific IDs to store back in subscription_plans table
  stripeProductId?: string
  stripePriceId?: string
  cashfreePlanId?: string
}

// -----------------------------------------------------------------------------
// CreateSubscriptionParams
// What the create-subscription function sends to a provider's createSubscription()
// -----------------------------------------------------------------------------
export interface CreateSubscriptionParams {
  plan: SubscriptionPlan
  merchant: Merchant
  customerName: string
  customerEmail: string
  customerPhone?: string  // Required for Cashfree (UPI mandate), ignored by Stripe
  successUrl: string
  cancelUrl: string
}

export interface CreateSubscriptionResult {
  checkoutUrl: string
  providerSubscriptionId?: string
  cashfreeSessionId?: string
  isSandbox?: boolean
}

// -----------------------------------------------------------------------------
// CancelSubscriptionParams
// -----------------------------------------------------------------------------
export interface CancelSubscriptionParams {
  subscriber: Subscriber
  merchant: Merchant
}

// -----------------------------------------------------------------------------
// MigrateSubscriptionParams
// Used during plan migration (Phase 4)
// -----------------------------------------------------------------------------
export interface MigrateSubscriptionParams {
  subscriber: Subscriber
  targetPlan: SubscriptionPlan
  merchant: Merchant
}
