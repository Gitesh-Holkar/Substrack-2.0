// supabase/functions/manage-stripe-plan/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get merchant's Stripe API key
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('stripe_api_key')
      .eq('id', user.id)
      .single()

    if (merchantError || !merchant?.stripe_api_key) {
      throw new Error(
        'Stripe API key not configured. Please add it in Settings.'
      )
    }

    // Initialize Stripe with merchant's key
    const stripe = new Stripe(merchant.stripe_api_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.json()
    const { action } = body

    let result: Record<string, unknown> = {}

    switch (action) {
      case 'create': {
        const {
          planId,
          planName,
          planDescription,
          price,
          currency,
          billingCycle,
        } = body

        // Create product in Stripe
        const product = await stripe.products.create({
          name: planName,
          description: planDescription || undefined,
        })

        // Map billing cycle to Stripe interval
        let interval: 'day' | 'week' | 'month' | 'year' = 'month'
        let intervalCount = 1

        switch (billingCycle.toLowerCase()) {
          case 'daily':
            interval = 'day'
            break
          case 'weekly':
            interval = 'week'
            break
          case 'monthly':
            interval = 'month'
            break
          case 'quarterly':
            interval = 'month'
            intervalCount = 3
            break
          case 'yearly':
            interval = 'year'
            break
        }

        // Create price in Stripe
        const stripePrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(price * 100), // Convert to cents
          currency: currency.toLowerCase(),
          recurring: {
            interval,
            interval_count: intervalCount,
          },
        })

        // Update plan in Supabase with Stripe IDs
        const { error: updateError } = await supabase
          .from('subscription_plans')
          .update({
            stripe_product_id: product.id,
            stripe_price_id: stripePrice.id,
          })
          .eq('id', planId)
          .eq('merchant_id', user.id)

        if (updateError) {
          throw new Error('Failed to update plan with Stripe IDs')
        }

        result = {
          success: true,
          productId: product.id,
          priceId: stripePrice.id,
        }
        break
      }

      case 'update': {
        const { stripeProductId, planName, planDescription } = body

        // Update product in Stripe
        await stripe.products.update(stripeProductId, {
          name: planName,
          description: planDescription || undefined,
        })

        result = { success: true }
        break
      }

      case 'archive': {
        const { stripeProductId } = body

        // Archive product in Stripe
        await stripe.products.update(stripeProductId, {
          active: false,
        })

        result = { success: true }
        break
      }

      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error managing Stripe plan:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
