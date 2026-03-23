// CONVENTIONS:
//   - Merchant: full authenticated merchant profile (dashboard use only)
//   - PublicMerchant: safe subset for public-facing pages
//     Never add Stripe keys, Cashfree keys, or secrets to PublicMerchant.
//   - Money values are stored as `numeric` in Postgres (INR rupees).
//     Display: amount.toFixed(2). Never use floats for arithmetic.

export type PaymentProvider = 'stripe' | 'cashfree'

// -----------------------------------------------------------------------------
// Merchant
// -----------------------------------------------------------------------------
export interface Merchant {
  id: string
  email: string
  full_name: string
  business_name: string
  business_address?: string
  gst_number?: string
  logo_url?: string
  phone?: string
  redirect_url?: string
  widget_id?: string
  plan_tier: 'free' | 'starter' | 'pro' | 'enterprise'

  // Payment provider
  payment_provider: PaymentProvider

  // Stripe credentials (keep — existing merchants use these)
  stripe_api_key?: string
  stripe_publishable_key?: string
  stripe_webhook_secret?: string

  // Cashfree credentials
  cashfree_app_id?: string
  cashfree_secret_key?: string
  cashfree_webhook_secret?: string

  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// PublicMerchant — safe subset for unauthenticated pages
// -----------------------------------------------------------------------------
export interface PublicMerchant {
  id: string
  business_name: string
  email: string
  logo_url: string | null
  redirect_url: string | null
  payment_provider: PaymentProvider
}

// -----------------------------------------------------------------------------
// SubscriptionPlan
// -----------------------------------------------------------------------------
export interface SubscriptionPlan {
  id: string
  merchant_id: string
  name: string
  description?: string
  price: number
  currency: string
  billing_cycle: string
  features: string[]
  is_active: boolean
  subscriber_count: number

  // Stripe IDs (keep — existing plans have these)
  stripe_product_id?: string
  stripe_price_id?: string

  // Cashfree ID
  cashfree_plan_id?: string

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
  status: 'active' | 'cancelled' | 'failed' | 'past_due'

  payment_provider: PaymentProvider

  // Unified fields — used for all new records (both Stripe and Cashfree)
  provider_subscription_id?: string
  provider_customer_id?: string

  // Legacy Stripe fields — kept for existing subscribers and backwards compat
  stripe_subscription_id?: string
  stripe_customer_id?: string

  start_date: string
  next_renewal_date?: string
  last_payment_date?: string
  last_payment_amount?: number

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

  payment_provider: PaymentProvider

  // Unified field — used for all new records
  provider_payment_id?: string

  // Legacy Stripe field — kept for existing transactions
  stripe_payment_id?: string

  payment_date: string
  created_at: string
}