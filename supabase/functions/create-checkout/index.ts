// supabase/functions/create-checkout/index.ts - FIXED WITH CORS
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🔥 FIX: Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 🔥 FIX: Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, customerEmail, customerName, planId, merchantId } = await req.json()

    console.log('📦 Received checkout request:', {
      priceId,
      customerEmail,
      customerName,
      planId,
      merchantId,
    })

    if (!priceId || !customerEmail || !customerName || !planId || !merchantId) {
      throw new Error('Missing required fields: priceId, customerEmail, customerName, planId, merchantId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get merchant's Stripe keys and redirect URL
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('stripe_api_key, stripe_publishable_key, business_name, redirect_url')
      .eq('id', merchantId)
      .single()

    if (merchantError || !merchant?.stripe_api_key) {
      console.error('❌ Merchant not found or Stripe key missing:', merchantError)
      throw new Error('Merchant Stripe key not found')
    }

    console.log('✅ Merchant found:', merchant.business_name)

    // Initialize Stripe with merchant's secret key
    const stripe = new Stripe(merchant.stripe_api_key, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get origin for success/cancel URLs
    const origin = req.headers.get('origin') || 'http://localhost:5173'
    
    // Determine success URL
    let successUrl: string
    if (merchant.redirect_url) {
      // Use merchant's custom redirect URL
      successUrl = `${merchant.redirect_url}?substrack_session={CHECKOUT_SESSION_ID}`
    } else {
      // Default to Substrack success page
      successUrl = `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}&merchant=${encodeURIComponent(merchant.business_name)}`
    }

    const cancelUrl = merchant.redirect_url 
      ? `${merchant.redirect_url}?cancelled=true`
      : `${origin}/subscription-cancelled`

    console.log('🔗 Creating Stripe checkout session...')
    console.log('Success URL:', successUrl)
    console.log('Cancel URL:', cancelUrl)

    // Create checkout session with metadata
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // 🔥 CRITICAL: This metadata is passed to all subsequent events
      metadata: {
        merchant_id: merchantId,
        plan_id: planId,
        customer_name: customerName,
      },
      // Also set subscription_data metadata to ensure it's on the subscription
      subscription_data: {
        metadata: {
          merchant_id: merchantId,
          plan_id: planId,
          customer_name: customerName,
        },
      },
    })

    console.log('✅ Checkout session created:', session.id)
    console.log('📝 Metadata set:', {
      merchant_id: merchantId,
      plan_id: planId,
      customer_name: customerName,
    })

    // 🔥 FIX: Return response with CORS headers
    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('💥 Error creating checkout session:', error)
    // 🔥 FIX: Return error with CORS headers
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})