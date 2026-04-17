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
  status: 'active' | 'cancelled' | 'failed' | 'past_due' | 'pending'

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
  cancelled_at?: string

  // Dunning lifecycle
  dunning_step?: number
  dunning_started_at?: string
  next_retry_at?: string

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

// -----------------------------------------------------------------------------
// MerchantAiProfile — GIWI business profile and conversation memory
// One row per merchant. Written by merchant via settings. Read by GIWI on every request.
// -----------------------------------------------------------------------------
export type GiwiLanguage = 'english' | 'hinglish'
export type GiwiBusinessType = 'saas' | 'agency' | 'consultancy' | 'professional_service' | 'other'

export interface GiwiMemoryEntry {
  type: 'intention' | 'fact'
  text: string
  created_at: string
  expires_at?: string // only for intentions (60-day rolling expiry)
}

export interface MerchantAiProfile {
  id: string
  merchant_id: string
  business_description: string | null // max 300 chars
  target_customers: string | null     // max 200 chars
  business_goal: string | null        // max 200 chars
  business_type: GiwiBusinessType | null
  preferred_language: GiwiLanguage
  onboarding_completed: boolean
  conversation_memory: GiwiMemoryEntry[]
  last_brief_shown_at: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// PlanBadgeState — AI-computed plan health badge
// Stored in merchant_ai_context.badge_data as a map of plan_id -> PlanBadge
// -----------------------------------------------------------------------------
export type PlanBadgeState = 'growing' | 'stable' | 'high_churn' | 'needs_attention' | 'new'

export interface PlanBadge {
  state: PlanBadgeState
  tooltip: string
}

// -----------------------------------------------------------------------------
// MetricInsight — AI-generated explanation and chips for a dashboard metric card
// -----------------------------------------------------------------------------
export interface MetricInsight {
  explanation: string
  chips: [string, string, string] // always exactly 3: chip[0] is always "What is [metric]?"
}

// -----------------------------------------------------------------------------
// GiwiInsights — full dashboard insights payload stored in merchant_ai_context
// -----------------------------------------------------------------------------
export interface GiwiInsights {
  mrr: MetricInsight
  active_subscribers: MetricInsight
  churn_rate: MetricInsight
  arpu: MetricInsight
  insight_card: {
    points: [string, string, string, string] // exactly 4 bullet points
  }
  computed_at: string
}

// -----------------------------------------------------------------------------
// MerchantContextDocument — pre-computed business signals. Zero PII.
// Written by service role only. Read by authenticated merchant (SELECT only).
// -----------------------------------------------------------------------------
export interface MerchantContextDocument {
  computed_at: string
  business_summary: {
    total_active_subscribers: number
    total_plans: number
    active_plans: number
  }
  revenue: {
    mrr: number           // INR rupees
    arr: number           // INR rupees
    mrr_last_month: number
    mrr_growth_percent: number
    arpu: number          // INR rupees
  }
  subscribers: {
    active: number
    past_due: number
    revenue_at_risk: number
    new_this_month: number
    cancelled_this_month: number
    net_change_this_month: number
    churn_rate_percent: number
    upcoming_renewals_7d: number
    avg_tenure_days: number
  }
  payments: {
    failed_this_month: number
    total_this_month: number
    failed_payment_rate_percent: number
  }
  plans: Array<{
    plan_id: string
    plan_name: string
    price: number         // INR rupees
    billing_cycle: string
    active_subscribers: number
    new_this_month: number
    cancelled_this_month: number
    revenue_contribution_percent: number
    trial_period_days: number
  }>
  risk_signals: {
    high_concentration_risk: boolean
    top_3_revenue_percent: number
    early_churn_dominant: boolean
  }
}

export interface MerchantAiContext {
  id: string
  merchant_id: string
  context_document: MerchantContextDocument
  badge_data: Record<string, PlanBadge>  // plan_id -> PlanBadge
  dashboard_insights: GiwiInsights | Record<string, never>
  dashboard_insights_computed_at: string | null
  last_computed_at: string
  is_computing: boolean
  computing_started_at: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// GiwiMessage — a single message in the GIWI chat panel
// -----------------------------------------------------------------------------
export interface GiwiMessage {
  id: string
  role: 'giwi' | 'user'
  content: string                      // display version (placeholders already replaced)
  rawContent?: string                  // pre-replacement version used for summarisation
  chips?: [string, string, string]     // shown below GIWI messages only
  timestamp: string
}

// -----------------------------------------------------------------------------
// PlanSuggestion — returned by /api/ai/suggest-plans
// -----------------------------------------------------------------------------
export interface PlanSuggestion {
  name: string
  description: string
  price: number                        // INR rupees, integer
  billing_cycle: 'monthly' | 'yearly' | 'quarterly'
  trial_period_days: number
  features: string[]                   // max 5 items
  positioning: string                  // who this plan is for
}
