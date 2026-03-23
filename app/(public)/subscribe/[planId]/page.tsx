'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, XCircle } from 'lucide-react'
import type { PaymentProvider } from '@/lib/types'

interface PublicMerchant {
  id: string
  business_name: string
  email: string
  logo_url: string | null
  redirect_url: string | null
  payment_provider: PaymentProvider
}

interface PublicPlan {
  id: string
  merchant_id: string
  name: string
  description: string | null
  price: number
  currency: string
  billing_cycle: string
  features: string[]
  is_active: boolean
  archived_at: string | null
  merchants_public: PublicMerchant
}

export default function SubscribePage() {
  const params = useParams()
  const planId = params.planId as string

  const [plan, setPlan] = useState<PublicPlan | null>(null)
  const [merchant, setMerchant] = useState<PublicMerchant | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [planInactive, setPlanInactive] = useState(false)
  const [cashfreeReady, setCashfreeReady] = useState(false)

  const supabase = createClient()
  const isCashfree = merchant?.payment_provider === 'cashfree'

  useEffect(() => {
    loadPlanDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  const loadPlanDetails = async (): Promise<void> => {
    try {
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select(`
          id,
          merchant_id,
          name,
          description,
          price,
          currency,
          billing_cycle,
          features,
          is_active,
          archived_at,
          merchants_public (
            id,
            business_name,
            email,
            logo_url,
            redirect_url,
            payment_provider
          )
        `)
        .eq('id', planId)
        .single()

      if (planError) throw planError
      if (!planData) {
        setError('Plan not found')
        return
      }

      const typedPlan = planData as unknown as PublicPlan
      setPlan(typedPlan)
      setMerchant(typedPlan.merchants_public)

      if (!typedPlan.is_active || !!typedPlan.archived_at) {
        setPlanInactive(true)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load plan details'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (isCashfree && !customerPhone.trim()) {
      setError('Phone number is required to set up your subscription.')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const body: Record<string, string> = {
        planId: plan!.id,
        merchantId: plan!.merchant_id,
        customerName,
        customerEmail,
      }

      if (isCashfree) body.customerPhone = customerPhone

      const { data, error: fnError } = await supabase.functions.invoke('create-subscription', {
        body,
      })

      if (fnError) throw fnError

      if (isCashfree) {
        if (!data?.cashfreeSessionId) throw new Error('No Cashfree session ID returned')

        if (!cashfreeReady) {
          setError('Payment SDK is loading. Please try again in a moment.')
          setProcessing(false)
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cashfree = (window as any).Cashfree({
          mode: data.isSandbox ? 'sandbox' : 'production',
        })
        cashfree.subscriptionsCheckout({
          subsSessionId: data.cashfreeSessionId,
          redirectTarget: '_self',
        })
      } else {
        if (!data?.url) throw new Error('No checkout URL returned')
        window.location.href = data.url as string
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate payment. Please try again.'
      setError(message)
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Plan Not Available</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (planInactive && plan) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 text-center">
            <div className="mb-6">
              <XCircle className="w-20 h-20 text-orange-500 mx-auto" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Plan Temporarily Unavailable
            </h1>
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{plan.name}</h2>
              <p className="text-2xl font-bold text-gray-600">
                ₹{plan.price}
                <span className="text-base font-normal"> per {plan.billing_cycle}</span>
              </p>
            </div>
            <p className="text-lg text-gray-600 mb-4">
              This subscription plan is currently paused by{' '}
              {merchant?.business_name || 'the merchant'}.
            </p>
            <p className="text-gray-500 mb-8">
              New subscriptions are temporarily unavailable.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!plan) return null

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 py-12 px-4">
      {isCashfree && (
        <Script
          src="https://sdk.cashfree.com/js/v3/cashfree.js"
          strategy="afterInteractive"
          onLoad={() => setCashfreeReady(true)}
        />
      )}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Plan Details */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {merchant?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={merchant.logo_url}
              alt={merchant.business_name}
              className="h-12 mb-6 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {merchant?.business_name}
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{plan.name}</h2>
          <p className="text-4xl font-bold text-blue-600 mb-4">
            ₹{plan.price}
            <span className="text-lg font-normal text-gray-500"> per {plan.billing_cycle}</span>
          </p>
          {plan.description && (
            <p className="text-gray-600 mb-6">{plan.description}</p>
          )}
          {plan.features.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-800 mb-4">What is included:</h3>
              <ul className="space-y-3">
                {plan.features.map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Checkout Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Complete Your Subscription
          </h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubscribe} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>

            {/* Phone number — only shown for Cashfree merchants (UPI mandate requirement) */}
            {isCashfree && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  pattern="[6-9][0-9]{9}"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9876543210"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required to set up UPI AutoPay for recurring payments.
                </p>
              </div>
            )}

            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">₹{plan.price}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Billing Cycle</span>
                <span className="font-semibold capitalize">{plan.billing_cycle}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-4">
                <span>Total</span>
                <span className="text-blue-600">₹{plan.price}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue to Payment'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Your payment will be processed securely by{' '}
              {isCashfree ? 'Cashfree' : 'Stripe'}
            </p>
          </form>
        </div>

      </div>
    </div>
  )
}
