// supabase/functions/check-subscription/index.ts
// Email-based subscription verification - NO JWT TOKENS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log incoming request
  console.log('📥 Incoming request:', req.method, req.url)

  try {
    const { email, merchant_id } = await req.json()

    console.log('🔍 Checking subscription for email:', email, 'Merchant ID:', merchant_id)

    // Validate inputs
    if (!email || !merchant_id) {
      throw new Error('Missing email or merchant_id parameter')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Query database for active subscription
const { data: subscriber, error: subscriberError } = await supabase
  .from('subscribers')
  .select(`
    id,
    customer_email,
    customer_name,
    status,
    next_renewal_date,
    last_payment_date,
    last_payment_amount,
    start_date,
    subscription_plans!plan_id (
      id,
      name,
      price,
      billing_cycle,
      features,
      description
    )
  `)
  .ilike('customer_email', email.trim())
  .eq('merchant_id', merchant_id)
  .eq('status', 'active')
  .limit(1)
  .single();


    // If no active subscription found
    if (subscriberError || !subscriber) {
      console.log('ℹ️ No active subscription found for:', email)
      
      return new Response(
        JSON.stringify({
          has_subscription: false,
          message: 'No active subscription found for this email'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Active subscription found
    console.log('✅ Active subscription found for:', email)
    console.log('📋 Plan:', (subscriber.subscription_plans as any)?.name)
    console.log('📋 Status:', subscriber.status)

    const plan = subscriber.subscription_plans as any

    // Return subscription details
    return new Response(
      JSON.stringify({
        has_subscription: true,
        subscriber: {
          email: subscriber.customer_email,
          name: subscriber.customer_name,
          plan: plan?.name || 'Unknown Plan',
          plan_id: plan?.id,
          price: plan?.price,
          billing_cycle: plan?.billing_cycle,
          features: plan?.features || [],
          description: plan?.description,
          status: subscriber.status,
          start_date: subscriber.start_date,
          next_renewal_date: subscriber.next_renewal_date,
          last_payment_date: subscriber.last_payment_date,
          last_payment_amount: subscriber.last_payment_amount,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('❌ Error checking subscription:', error.message)
    return new Response(
      JSON.stringify({ 
        has_subscription: false,
        error: error.message || 'Failed to check subscription',
        details: 'Please ensure email and merchant_id are correct'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
