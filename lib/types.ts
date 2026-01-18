
export interface Merchant {
  id: string;
  email: string;
  full_name: string;
  business_name: string;
  gst_number?: string;
  bank_account?: string;
  bank_ifsc?: string;
  logo_url?: string;
  stripe_api_key?: string;
  stripe_publishable_key?: string;
  stripe_webhook_secret?: string;
  widget_id?: string;
  redirect_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  merchant_id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  is_active: boolean;
  subscriber_count: number;
  stripe_product_id?: string;
  stripe_price_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscriber {
  id: string;
  merchant_id: string;
  plan_id: string;
  customer_name: string;
  customer_email: string;
  status: 'active' | 'cancelled' | 'failed';
  start_date: string;
  next_renewal_date?: string;
  last_payment_date?: string;
  last_payment_amount?: number;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  merchant_id: string;
  subscriber_id: string;
  plan_id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  stripe_payment_id?: string;
  payment_date: string;
  created_at: string;
}

export interface AccessToken {
  id: string;
  merchant_id: string;
  subscriber_id: string;
  token: string;
  stripe_session_id?: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}