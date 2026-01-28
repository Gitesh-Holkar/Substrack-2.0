'use client'

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Check, XCircle } from 'lucide-react';

export default function SubscribePage() {
  const params = useParams();
  const planId = params.planId as string;
  
  const [plan, setPlan] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [planInactive, setPlanInactive] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadPlanDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const loadPlanDetails = async () => {
    try {
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*, merchants(*)')
        .eq('id', planId)
        .single();

      if (planError) throw planError;
      if (!planData) {
        setError('Plan not found');
        return;
      }

      console.log('✅ Plan loaded:', planData);
      setPlan(planData);
      setMerchant((planData as any).merchants);

      if (!planData.is_active) {
        setPlanInactive(true);
      }
    } catch (err: any) {
      console.error('Error loading plan:', err);
      setError('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plan?.stripe_price_id) {
      setError('Plan is not configured for payments. Please contact support.');
      return;
    }

    if (!merchant?.stripe_publishable_key) {
      setError('Merchant payment system is not configured. Please contact support.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      console.log('🚀 Creating checkout with:', {
        priceId: plan.stripe_price_id,
        customerEmail,
        customerName,
        planId: plan.id,
        merchantId: merchant.id,
      });

      const { data, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: plan.stripe_price_id,
          customerEmail,
          customerName,
          planId: plan.id,
          merchantId: merchant.id,
        },
      });

      if (checkoutError) {
        console.error('❌ Checkout error:', checkoutError);
        throw checkoutError;
      }

      if (!data?.url) {
        throw new Error('No checkout URL returned from server');
      }

      console.log('✅ Checkout URL received:', data.url);
      window.location.href = data.url;
    } catch (err: any) {
      console.error('💥 Error creating checkout:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
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
    );
  }

  if (planInactive) {
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
              This subscription plan is currently paused by {merchant?.business_name || 'the merchant'}.
            </p>
            <p className="text-gray-500 mb-8">
              New subscriptions are temporarily unavailable. Please check back later or contact support for more information.
            </p>

            {merchant?.email && (
              <div className="border-t pt-6">
                <p className="text-sm text-gray-500 mb-3">Need assistance?</p>
                <a
                  href={`mailto:${merchant.email}`}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Contact Support
                </a>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                &larr; Go Back
              </button>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Existing subscribers are not affected and will continue to have access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Subscribe to {merchant?.business_name}
          </h1>
          <p className="text-gray-600">Choose your plan and get started today</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h2>
            <p className="text-4xl font-bold text-blue-600 mb-4">
              ₹{plan.price}
              <span className="text-lg font-normal text-gray-500"> per {plan.billing_cycle}</span>
            </p>
            <p className="text-gray-600 mb-6">{plan.description}</p>

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
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Subscription</h2>

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
                Your payment will be processed securely by Stripe
              </p>
            </form>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Secure Payment
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Cancel Anytime
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Email Support
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}