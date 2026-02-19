
// CONVENTIONS:
//   - Merchant: full authenticated merchant profile (dashboard use only)
//   - PublicMerchant: safe subset for public-facing pages (subscribe page, etc.)
//     Never add Stripe keys or sensitive fields to PublicMerchant.
//   - Money values are stored as `numeric` in Postgres (INR rupees).
//     Display: amount.toFixed(2). Never use floats for arithmetic.

// -----------------------------------------------------------------------------
// Merchant — full profile, only used in authenticated dashboard context
// -----------------------------------------------------------------------------
export interface Merchant {
  id: string
  email: string
  full_name: string
  business_name: string
  business_address?: string
  gst_number?: string
  logo_url?: string
  stripe_api_key?: string
  stripe_publishable_key?: string
  stripe_webhook_secret?: string
  widget_id?: string
  redirect_url?: string
  phone?: string
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// PublicMerchant — safe subset for unauthenticated pages
// Only fields required to render the subscribe page and contact info.
// Never add Stripe keys, webhook secrets, or bank details here.
// -----------------------------------------------------------------------------
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
  description?: string
  price: number
  currency: string
  billing_cycle: string
  features: string[]
  is_active: boolean
  subscriber_count: number
  stripe_product_id?: string
  stripe_price_id?: string
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
  status: 'active' | 'cancelled' | 'failed'
  start_date: string
  next_renewal_date?: string
  last_payment_date?: string
  last_payment_amount?: number
  stripe_subscription_id?: string
  stripe_customer_id?: string
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
  stripe_payment_id?: string
  payment_date: string
  created_at: string
}

