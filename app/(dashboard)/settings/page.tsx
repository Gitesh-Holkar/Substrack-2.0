'use client'

import { useState, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  Copy,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react'
import Image from 'next/image'
import { IntegrationsTab } from '@/components/dashboard/IntegrationsTab'
import { isGatewayCredentialsSaved } from '@/lib/gateway'
import type { GatewayProvider } from '@/lib/gateway'

interface StripeConstructor {
  new (apiKey: string, config: { apiVersion: string; httpClient?: unknown }): {
    products: { list: (params: { limit: number }) => Promise<unknown> }
  }
  createFetchHttpClient?: () => unknown
}

interface MerchantPaymentConfig {
  payment_provider?: 'stripe' | 'cashfree'
  cashfree_app_id?: string
  cashfree_secret_key?: string
  cashfree_webhook_secret?: string
}

export default function Settings() {
  const { user, merchant, refreshMerchant } = useAuth()
  const [activeTab, setActiveTab] = useState<'business' | 'stripe' | 'integrations' | 'ai'>('business')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showPublishableKey, setShowPublishableKey] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [testingStripe, setTestingStripe] = useState(false)
  const [stripeTestResult, setStripeTestResult] = useState<'success' | 'error' | null>(null)
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [cashfreeInfo, setCashfreeInfo] = useState({
    cashfree_app_id: '',
    cashfree_secret_key: '',
  })
  const [showCashfreeSecret, setShowCashfreeSecret] = useState(false)
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'cashfree'>('stripe')
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [pendingSwitchProvider, setPendingSwitchProvider] = useState<GatewayProvider | null>(null)
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [selectedGateway, setSelectedGateway] = useState<'stripe' | 'cashfree'>('stripe')

  // ✅ FIX #1: Window access - Initialize as empty, set in useEffect
  const [webhookUrl, setWebhookUrl] = useState('')

  const supabase = createClient()
  // Prevents the merchant useEffect from overwriting user-typed form values
  // when AuthContext refreshes the merchant object (e.g., on tab visibility change).
  const hasInitialized = useRef(false)

  // ✅ FIX #1: Set webhook URL client-side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin.replace(
        window.location.hostname,
        'niisdiotuzvydotoaurt.supabase.co'
      )}/functions/v1/stripe-webhook`
      setWebhookUrl(url)
    }
  }, [])

  const [businessInfo, setBusinessInfo] = useState({
    full_name: '',
    business_name: '',
    email: '',
    phone: '',
    business_address: '',
    gst_number: '',
    logo_url: '',
    redirect_url: '',
  })

  const [stripeInfo, setStripeInfo] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
  })

  useEffect(() => {
    if (merchant && !hasInitialized.current) {
      hasInitialized.current = true
      const merchantPaymentConfig = merchant as typeof merchant & MerchantPaymentConfig

      setBusinessInfo({
        full_name: merchant.full_name || '',
        business_name: merchant.business_name || '',
        email: merchant.email || '',
        phone: (merchant as { phone?: string }).phone || '',
        business_address: (merchant as { business_address?: string }).business_address || '',
        gst_number: merchant.gst_number || '',
        logo_url: merchant.logo_url || '',
        redirect_url: (merchant as { redirect_url?: string }).redirect_url || '',
      })
      setStripeInfo({
        stripe_secret_key: merchant.stripe_api_key || '',
        stripe_publishable_key: merchant.stripe_publishable_key || '',
        stripe_webhook_secret: (merchant as { stripe_webhook_secret?: string }).stripe_webhook_secret || '',
      })
      setCashfreeInfo({
        cashfree_app_id: merchantPaymentConfig.cashfree_app_id || '',
        cashfree_secret_key: merchantPaymentConfig.cashfree_secret_key || '',
      })
      const activeProvider = merchantPaymentConfig.payment_provider || 'stripe'
      setPaymentProvider(activeProvider)
      setSelectedGateway(activeProvider)
      setLogoPreview(merchant.logo_url || null)
    }
  }, [merchant])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size should be less than 2MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return businessInfo.logo_url || null

    setUploadingLogo(true)
    try {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('merchant-assets')
        .upload(filePath, logoFile)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('merchant-assets').getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo. Please try again.')
      return null
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleBusinessInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage('')

    try {
      const logoUrl = await uploadLogo()

      const { error } = await supabase
        .from('merchants')
        .update({
          full_name: businessInfo.full_name,
          business_name: businessInfo.business_name,
          phone: businessInfo.phone,
          business_address: businessInfo.business_address,
          gst_number: businessInfo.gst_number,
          logo_url: logoUrl,
          redirect_url: businessInfo.redirect_url.trim() || null,
        })
        .eq('id', user!.id)

      if (error) throw error

      await refreshMerchant()
      setSuccessMessage('Business information updated successfully!')
      setLogoFile(null)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error updating business info:', error)
      alert('Failed to update business information')
    } finally {
      setLoading(false)
    }
  }

  const validateStripeKey = (
    key: string,
    type: 'secret' | 'publishable'
  ): boolean => {
    if (!key) return false

    if (type === 'secret') {
      return key.startsWith('sk_test_') || key.startsWith('sk_live_')
    } else {
      return key.startsWith('pk_test_') || key.startsWith('pk_live_')
    }
  }

  const testStripeConnection = async () => {
    if (!validateStripeKey(stripeInfo.stripe_secret_key, 'secret')) {
      setStripeTestResult('error')
      alert('Invalid Stripe Secret Key format. Must start with sk_test_ or sk_live_')
      return
    }

    setTestingStripe(true)
    setStripeTestResult(null)

    try {
      // ✅ FIX #3: Proper dynamic import with type casting
      const { default: Stripe } = await import('stripe') as { default: StripeConstructor }
      
      const stripe = new Stripe(stripeInfo.stripe_secret_key, {
        apiVersion: '2023-10-16',
      })

      await stripe.products.list({ limit: 1 })
      setStripeTestResult('success')
    } catch (error) {
      console.error('Stripe test failed:', error)
      setStripeTestResult('error')
    } finally {
      setTestingStripe(false)
    }
  }

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text)
    setWebhookUrlCopied(true)
    setTimeout(() => setWebhookUrlCopied(false), 2000)
  }

  const handleStripeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage('')

    if (!validateStripeKey(stripeInfo.stripe_secret_key, 'secret')) {
      alert('Invalid Stripe Secret Key. Must start with sk_test_ or sk_live_')
      setLoading(false)
      return
    }

    if (!validateStripeKey(stripeInfo.stripe_publishable_key, 'publishable')) {
      alert('Invalid Stripe Publishable Key. Must start with pk_test_ or pk_live_')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          stripe_api_key: stripeInfo.stripe_secret_key,
          stripe_publishable_key: stripeInfo.stripe_publishable_key,
          stripe_webhook_secret: stripeInfo.stripe_webhook_secret,
        })
        .eq('id', user!.id)

      if (error) throw error

      await refreshMerchant()
      setSuccessMessage('Stripe API keys updated successfully!')
      setStripeTestResult(null)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error updating Stripe keys:', error)
      alert('Failed to update Stripe API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleCashfreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage('')

    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          cashfree_app_id: cashfreeInfo.cashfree_app_id,
          cashfree_secret_key: cashfreeInfo.cashfree_secret_key,
        })
        .eq('id', user!.id)

      if (error) throw error

      await refreshMerchant()
      setSuccessMessage('Cashfree credentials saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error saving Cashfree credentials:', error)
      alert('Failed to save Cashfree credentials')
    } finally {
      setLoading(false)
    }
  }

  const requestProviderSwitch = (provider: GatewayProvider): void => {
    if (provider === paymentProvider) return
    setPendingSwitchProvider(provider)
    setShowSwitchModal(true)
  }

  const confirmProviderSwitch = async (): Promise<void> => {
    if (!pendingSwitchProvider) return

    setSwitchingProvider(true)
    setShowSwitchModal(false)
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ payment_provider: pendingSwitchProvider })
        .eq('id', user!.id)

      if (error) throw error

      setPaymentProvider(pendingSwitchProvider)
      await refreshMerchant()
      setSuccessMessage(
        `Payment gateway switched to ${pendingSwitchProvider === 'stripe' ? 'Stripe' : 'Cashfree'}`
      )
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Error switching provider:', err)
      alert('Failed to switch payment provider')
    } finally {
      setSwitchingProvider(false)
      setPendingSwitchProvider(null)
    }
  }

  const cancelProviderSwitch = (): void => {
    setShowSwitchModal(false)
    setPendingSwitchProvider(null)
  }

  return (
    <>
      <div className='w-full max-w-5xl'>
        {successMessage && (
          <div className='mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center'>
            <Check className='w-5 h-5 mr-2' />
            {successMessage}
          </div>
        )}

        <div className='bg-white rounded-xl shadow-sm'>
          <div className='border-b border-gray-200'>
            <nav className='flex space-x-8 px-6' aria-label='Tabs'>
              <button
                onClick={() => setActiveTab('business')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'business'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Business Profile
              </button>
              <button
                onClick={() => setActiveTab('stripe')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'stripe'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Payment Setup
              </button>
              <button
                onClick={() => setActiveTab('integrations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'integrations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Integrations
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'ai'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Assistant
              </button>
            </nav>
          </div>

          <div className='p-6'>
            {/* BUSINESS TAB */}
            {activeTab === 'business' && (
              <form onSubmit={handleBusinessInfoSubmit} className='space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800 mb-4'>
                    Business Information
                  </h3>
                  <p className='text-sm text-gray-600 mb-6'>
                    This information will appear on your invoices and payment pages.
                  </p>

                  <div className='mb-6'>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Business Logo
                    </label>
                    <div className='flex items-center space-x-4'>
                      <div className='h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50'>
                        {logoPreview ? (
                          <Image
                            src={logoPreview}
                            alt='Logo'
                            width={96}
                            height={96}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <ImageIcon className='h-10 w-10 text-gray-400' />
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor='logo-upload'
                          className='cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
                        >
                          <Upload className='w-4 h-4 mr-2' />
                          Upload Logo
                        </label>
                        <input
                          id='logo-upload'
                          type='file'
                          accept='image/*'
                          onChange={handleLogoChange}
                          className='hidden'
                        />
                        <p className='text-xs text-gray-500 mt-1'>
                          PNG, JPG up to 2MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Full Name *
                        </label>
                        <input
                          type='text'
                          value={businessInfo.full_name}
                          onChange={(e) =>
                            setBusinessInfo({
                              ...businessInfo,
                              full_name: e.target.value,
                            })
                          }
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          required
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Business Name *
                        </label>
                        <input
                          type='text'
                          value={businessInfo.business_name}
                          onChange={(e) =>
                            setBusinessInfo({
                              ...businessInfo,
                              business_name: e.target.value,
                            })
                          }
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          required
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Business Email *
                        </label>
                        <input
                          type='email'
                          value={businessInfo.email}
                          disabled
                          className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
                        />
                        <p className='text-xs text-gray-500 mt-1'>
                          Email cannot be changed
                        </p>
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Phone Number
                        </label>
                        <input
                          type='tel'
                          value={businessInfo.phone}
                          onChange={(e) =>
                            setBusinessInfo({
                              ...businessInfo,
                              phone: e.target.value,
                            })
                          }
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          placeholder='+91 98765 43210'
                        />
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Business Address
                      </label>
                      <textarea
                        value={businessInfo.business_address}
                        onChange={(e) =>
                          setBusinessInfo({
                            ...businessInfo,
                            business_address: e.target.value,
                          })
                        }
                        rows={3}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='Enter your complete business address'
                      />
                      <p className='text-xs text-gray-500 mt-1'>
                        This will appear on your invoices
                      </p>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        GST Number
                      </label>
                      <input
                        type='text'
                        value={businessInfo.gst_number}
                        onChange={(e) =>
                          setBusinessInfo({
                            ...businessInfo,
                            gst_number: e.target.value,
                          })
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='e.g., 22AAAAA0000A1Z5'
                      />
                      <p className='text-xs text-gray-500 mt-1'>
                        Optional - for Indian businesses
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Post-Payment Redirect URL
                      <span className='ml-1 font-normal text-gray-400'>(Optional)</span>
                    </label>
                    <p className='text-xs text-gray-500 mb-2'>
                      Where your customers land after a successful subscription. Leave empty to use Substrack&apos;s default success page.
                    </p>
                    <input
                      type='url'
                      value={businessInfo.redirect_url}
                      onChange={(e) =>
                        setBusinessInfo({
                          ...businessInfo,
                          redirect_url: e.target.value,
                        })
                      }
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='https://yourwebsite.com/thank-you'
                    />
                  </div>
                </div>

                <div className='flex justify-end'>
                  <button
                    type='submit'
                    disabled={loading || uploadingLogo}
                    className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center'
                  >
                    {uploadingLogo ? (
                      <>
                        <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                        Uploading...
                      </>
                    ) : loading ? (
                      'Saving...'
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STRIPE TAB */}
            {activeTab === 'stripe' && (
              <>
                {/* Gateway Selector */}
                <div className='bg-white rounded-lg border border-gray-200 p-6 mb-6'>
                  <h3 className='text-lg font-semibold text-gray-800 mb-1'>Active Payment Gateway</h3>
                  <p className='text-sm text-gray-500 mb-4'>
                    Choose which gateway processes payments for your subscribers.
                    Switching takes effect immediately for new subscriptions.
                  </p>
                  <div className='flex gap-3'>
                    {(['stripe', 'cashfree'] as const).map((provider) => {
                      const isActive = paymentProvider === provider
                      const isSelected = selectedGateway === provider
                      const isConfigured = merchant
                        ? isGatewayCredentialsSaved(merchant, provider)
                        : false
                      const label =
                        provider === 'stripe' ? 'Stripe' : 'Cashfree'

                      return (
                        <button
                          key={provider}
                          type='button'
                          onClick={() => setSelectedGateway(provider)}
                          className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                            isActive
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : isConfigured
                                ? 'border-green-400 bg-green-50 text-green-700 hover:border-green-500'
                                : isSelected
                                  ? 'border-gray-400 bg-gray-50 text-gray-700'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <span className='flex items-center gap-2'>
                            {isActive && <Check className='w-4 h-4 flex-shrink-0 text-blue-600' />}
                            {!isActive && isConfigured && (
                              <Check className='w-4 h-4 flex-shrink-0 text-green-500' />
                            )}
                            <span>
                              {label}
                              {isActive && (
                                <span className='block text-xs font-normal text-blue-600 mt-0.5'>
                                  Active gateway
                                </span>
                              )}
                              {!isActive && isConfigured && (
                                <span className='block text-xs font-normal text-green-600 mt-0.5'>
                                  Configured
                                </span>
                              )}
                              {!isActive && !isConfigured && (
                                <span className='block text-xs font-normal text-gray-400 mt-0.5'>
                                  Not configured
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedGateway === 'cashfree' && (
                  <>
                    {/* Cashfree Credentials */}
                    <div className='bg-white rounded-lg border border-gray-200 p-6 mb-6'>
                      <h3 className='text-lg font-semibold text-gray-800 mb-1'>Cashfree Configuration</h3>
                      <p className='text-sm text-gray-500 mb-4'>
                        Get your credentials from{' '}
                        <a
                          href='https://merchant.cashfree.com/merchants/login'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:underline'
                        >
                          Cashfree Dashboard
                        </a>{' '}
                        → Developers → API Keys.
                      </p>

                      <form onSubmit={handleCashfreeSubmit} className='space-y-4'>
                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>App ID</label>
                          <input
                            type='text'
                            value={cashfreeInfo.cashfree_app_id}
                            onChange={(e) =>
                              setCashfreeInfo({ ...cashfreeInfo, cashfree_app_id: e.target.value })
                            }
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                            placeholder='TEST12345678...'
                          />
                          <p className='text-xs text-gray-500 mt-1'>
                            Starts with TEST for sandbox, numeric for production
                          </p>
                        </div>

                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>Secret Key</label>
                          <div className='relative'>
                            <input
                              type={showCashfreeSecret ? 'text' : 'password'}
                              value={cashfreeInfo.cashfree_secret_key}
                              onChange={(e) =>
                                setCashfreeInfo({ ...cashfreeInfo, cashfree_secret_key: e.target.value })
                              }
                              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              placeholder='Your Cashfree secret key'
                            />
                            <button
                              type='button'
                              onClick={() => setShowCashfreeSecret(!showCashfreeSecret)}
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                            >
                              {showCashfreeSecret ? (
                                <EyeOff className='w-5 h-5' />
                              ) : (
                                <Eye className='w-5 h-5' />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          type='submit'
                          disabled={loading}
                          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2'
                        >
                          {loading ? (
                            <RefreshCw className='w-4 h-4 animate-spin' />
                          ) : (
                            <Check className='w-4 h-4' />
                          )}
                          Save Cashfree Credentials
                        </button>
                      </form>
                    </div>

                    {merchant &&
                      isGatewayCredentialsSaved(merchant, 'cashfree') &&
                      paymentProvider !== 'cashfree' && (
                        <div className='bg-white rounded-lg border border-gray-200 p-6'>
                          <h3 className='text-sm font-semibold text-gray-800 mb-1'>
                            Activate Cashfree
                          </h3>
                          <p className='text-sm text-gray-500 mb-4'>
                            New subscribers will be charged through Cashfree. Existing subscribers
                            stay on their current gateway until they resubscribe.
                          </p>
                          <button
                            type='button'
                            onClick={() => requestProviderSwitch('cashfree')}
                            disabled={switchingProvider}
                            className='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2'
                          >
                            {switchingProvider ? (
                              <RefreshCw className='w-4 h-4 animate-spin' />
                            ) : (
                              <Check className='w-4 h-4' />
                            )}
                            Set Cashfree as Active Gateway
                          </button>
                        </div>
                      )}
                  </>
                )}

                {selectedGateway === 'stripe' && (
                  <form onSubmit={handleStripeSubmit} className='space-y-6'>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800 mb-2'>
                      Stripe Integration
                    </h3>
                    <p className='text-sm text-gray-600 mb-6'>
                      Connect your Stripe account to accept payments. Get your API keys from your{' '}
                      <a
                        href='https://dashboard.stripe.com/apikeys'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:underline'
                      >
                        Stripe Dashboard
                      </a>
                      .
                    </p>

                    <div className='space-y-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Stripe Secret Key
                        </label>
                        <div className='flex gap-2'>
                          <div className='relative flex-1'>
                            <input
                              type={showSecretKey ? 'text' : 'password'}
                              value={stripeInfo.stripe_secret_key}
                              onChange={(e) =>
                                setStripeInfo({
                                  ...stripeInfo,
                                  stripe_secret_key: e.target.value,
                                })
                              }
                              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              placeholder='sk_live_...'
                            />
                            <button
                              type='button'
                              onClick={() => setShowSecretKey(!showSecretKey)}
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                            >
                              {showSecretKey ? (
                                <EyeOff className='w-5 h-5' />
                              ) : (
                                <Eye className='w-5 h-5' />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className='text-xs text-gray-500 mt-1'>
                          Starts with sk_live_ or sk_test_
                        </p>
                      </div>

                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Stripe Publishable Key
                        </label>
                        <div className='flex gap-2'>
                          <div className='relative flex-1'>
                            <input
                              type={showPublishableKey ? 'text' : 'password'}
                              value={stripeInfo.stripe_publishable_key}
                              onChange={(e) =>
                                setStripeInfo({
                                  ...stripeInfo,
                                  stripe_publishable_key: e.target.value,
                                })
                              }
                              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              placeholder='pk_live_...'
                            />
                            <button
                              type='button'
                              onClick={() =>
                                setShowPublishableKey(!showPublishableKey)
                              }
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                            >
                              {showPublishableKey ? (
                                <EyeOff className='w-5 h-5' />
                              ) : (
                                <Eye className='w-5 h-5' />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className='text-xs text-gray-500 mt-1'>
                          Starts with pk_live_ or pk_test_
                        </p>
                      </div>

                      <div className='border-t pt-4 mt-6'>
                        <h4 className='text-md font-semibold text-gray-800 mb-3'>
                          Webhook Configuration
                        </h4>
                        <p className='text-sm text-gray-600 mb-4'>
                          Configure webhooks in your{' '}
                          <a
                            href='https://dashboard.stripe.com/webhooks'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-600 hover:underline'
                          >
                            Stripe Dashboard
                          </a>{' '}
                          to receive subscription updates.
                        </p>

                        <div className='mb-4'>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Your Webhook URL
                          </label>
                          <div className='flex gap-2'>
                            <input
                              type='text'
                              value={webhookUrl}
                              readOnly
                              className='flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono'
                            />
                            <button
                              type='button'
                              onClick={() => copyToClipboard(webhookUrl)}
                              className='px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2'
                            >
                              {webhookUrlCopied ? (
                                <>
                                  <Check className='w-4 h-4 text-green-600' />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className='w-4 h-4' />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4'>
                          <p className='text-sm text-blue-800 font-medium mb-2'>
                            📋 Setup Instructions:
                          </p>
                          <ol className='text-sm text-blue-700 space-y-1 list-decimal list-inside'>
                            <li>Copy the webhook URL above</li>
                            <li>Go to Stripe Dashboard → Search Webhooks</li>
                            <li>Click &quot;Add destination&quot;</li>
                            <li>Select &quot;Your account&quot;</li>
                            <li>Select events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed</li>
                            <li>Click &quot;continue&quot; and Select Webhook endpoint</li>
                            <li>Enter the webhook URL</li>
                            <li>Copy the &quot;Signing secret&quot; (starts with whsec_)</li>
                            <li>Paste it below</li>
                          </ol>
                        </div>

                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Webhook Signing Secret
                          </label>
                          <div className='relative'>
                            <input
                              type={showWebhookSecret ? 'text' : 'password'}
                              value={stripeInfo.stripe_webhook_secret}
                              onChange={(e) =>
                                setStripeInfo({
                                  ...stripeInfo,
                                  stripe_webhook_secret: e.target.value,
                                })
                              }
                              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              placeholder='whsec_...'
                            />
                            <button
                              type='button'
                              onClick={() =>
                                setShowWebhookSecret(!showWebhookSecret)
                              }
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                            >
                              {showWebhookSecret ? (
                                <EyeOff className='w-5 h-5' />
                              ) : (
                                <Eye className='w-5 h-5' />
                              )}
                            </button>
                          </div>
                          <p className='text-xs text-gray-500 mt-1'>
                            Starts with whsec_
                          </p>
                        </div>
                      </div>

                      {stripeInfo.stripe_secret_key && (
                        <div className='pt-2'>
                          <button
                            type='button'
                            onClick={testStripeConnection}
                            disabled={testingStripe}
                            className='flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                          >
                            {testingStripe ? (
                              <>
                                <RefreshCw className='w-4 h-4 animate-spin' />
                                Testing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className='w-4 h-4' />
                                Test Connection
                              </>
                            )}
                          </button>

                          {stripeTestResult === 'success' && (
                            <div className='mt-3 flex items-center gap-2 text-sm text-green-600'>
                              <Check className='w-4 h-4' />
                              <span>Connection successful!</span>
                            </div>
                          )}

                          {stripeTestResult === 'error' && (
                            <div className='mt-3 flex items-center gap-2 text-sm text-red-600'>
                              <X className='w-4 h-4' />
                              <span>Connection failed. Check your keys.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='flex justify-end'>
                    <button
                      type='submit'
                      disabled={loading}
                      className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
                    >
                      {loading ? 'Saving...' : 'Save API Keys'}
                    </button>
                  </div>

                  {merchant &&
                    isGatewayCredentialsSaved(merchant, 'stripe') &&
                    paymentProvider !== 'stripe' && (
                      <div className='mt-6 pt-6 border-t border-gray-200'>
                        <h3 className='text-sm font-semibold text-gray-800 mb-1'>
                          Activate Stripe
                        </h3>
                        <p className='text-sm text-gray-500 mb-4'>
                          New subscribers will be charged through Stripe. Existing subscribers
                          stay on their current gateway until they resubscribe.
                        </p>
                        <button
                          type='button'
                          onClick={() => requestProviderSwitch('stripe')}
                          disabled={switchingProvider}
                          className='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2'
                        >
                          {switchingProvider ? (
                            <RefreshCw className='w-4 h-4 animate-spin' />
                          ) : (
                            <Check className='w-4 h-4' />
                          )}
                          Set Stripe as Active Gateway
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </>
            )}

            {/* INTEGRATIONS TAB */}
            {activeTab === 'integrations' && <IntegrationsTab />}

            {activeTab === 'ai' && (
              <AiAssistantTab />
            )}
          </div>
        </div>
      </div>

      {showSwitchModal && pendingSwitchProvider && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
          <div className='bg-white rounded-xl shadow-xl p-6 max-w-md w-full'>
            <div className='flex items-start gap-3 mb-4'>
              <div className='w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0'>
                <AlertTriangle className='w-5 h-5 text-yellow-600' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-gray-900'>
                  Switch from {paymentProvider === 'stripe' ? 'Stripe' : 'Cashfree'} to{' '}
                  {pendingSwitchProvider === 'stripe' ? 'Stripe' : 'Cashfree'}?
                </h3>
                <p className='text-sm text-gray-600 mt-1'>
                  All new subscribers will be charged through{' '}
                  {pendingSwitchProvider === 'stripe' ? 'Stripe' : 'Cashfree'} immediately.
                </p>
                <p className='text-sm text-gray-600 mt-2'>
                  Your existing subscribers stay on{' '}
                  <strong>{paymentProvider === 'stripe' ? 'Stripe' : 'Cashfree'}</strong> until
                  they cancel and resubscribe. You can switch back at any time.
                </p>
              </div>
            </div>
            <div className='flex gap-3 justify-end mt-6'>
              <button
                type='button'
                onClick={cancelProviderSwitch}
                className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={confirmProviderSwitch}
                disabled={switchingProvider}
                className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50'
              >
                {switchingProvider ? 'Switching...' : 'Yes, switch gateway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AiAssistantTab(): JSX.Element {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [targetCustomers, setTargetCustomers] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [businessType, setBusinessType] = useState<string>('')
  const [preferredLanguage, setPreferredLanguage] = useState<'english' | 'hinglish'>('english')

  useEffect(() => {
    if (!user) return
    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/ai/profile')
        if (res.ok) {
          const data = await res.json() as {
            data?: {
              business_description?: string
              target_customers?: string
              business_goal?: string
              business_type?: string
              preferred_language?: string
            } | null
          }
          if (data.data) {
            setBusinessDescription(data.data.business_description ?? '')
            setTargetCustomers(data.data.target_customers ?? '')
            setBusinessGoal(data.data.business_goal ?? '')
            setBusinessType(data.data.business_type ?? '')
            setPreferredLanguage((data.data.preferred_language as 'english' | 'hinglish') ?? 'english')
          }
        }
      } catch {
        // Non-critical load failure
      }
    }
    void load()
  }, [user])

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setLoading(true)
    setSuccessMessage('')
    try {
      const res = await fetch('/api/ai/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_description: businessDescription || null,
          target_customers: targetCustomers || null,
          business_goal: businessGoal || null,
          business_type: businessType || null,
          preferred_language: preferredLanguage,
          onboarding_completed: true,
        }),
      })
      if (res.ok) {
        setSuccessMessage('AI profile saved successfully!')
        setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold text-gray-800 mb-1'>GIWI AI Assistant</h3>
        <p className='text-sm text-gray-500'>
          Help GIWI understand your business so it can give you more relevant insights and advice.
        </p>
      </div>

      {successMessage && (
        <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2 text-sm'>
          <Check className='w-4 h-4 flex-shrink-0' />
          {successMessage}
        </div>
      )}

      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mt-0.5'>
            <svg className='w-4 h-4 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
            </svg>
          </div>
          <div>
            <p className='text-sm font-semibold text-blue-900'>Business insights are powered by Google Gemini</p>
            <p className='text-xs text-blue-700 mt-1'>
              Your aggregated business metrics (subscriber counts, revenue, churn rate) are shared with Google to generate insights.
              Individual subscriber names and emails are never sent to Google.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={(event) => void handleSave(event)} className='space-y-5'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Business Description
            <span className='ml-1 text-xs text-gray-400 font-normal'>({businessDescription.length}/300)</span>
          </label>
          <p className='text-xs text-gray-500 mb-2'>
            What does your business do and who does it serve?
          </p>
          <textarea
            value={businessDescription}
            onChange={(event) => setBusinessDescription(event.target.value.slice(0, 300))}
            rows={3}
            className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            placeholder='e.g. We provide cloud-based accounting software for Indian CAs and small businesses.'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Target Customers
            <span className='ml-1 text-xs text-gray-400 font-normal'>({targetCustomers.length}/200)</span>
          </label>
          <input
            type='text'
            value={targetCustomers}
            onChange={(event) => setTargetCustomers(event.target.value.slice(0, 200))}
            className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g. Small business owners and CAs across Tier 1 and Tier 2 Indian cities'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Current Business Goal
            <span className='ml-1 text-xs text-gray-400 font-normal'>({businessGoal.length}/200)</span>
          </label>
          <input
            type='text'
            value={businessGoal}
            onChange={(event) => setBusinessGoal(event.target.value.slice(0, 200))}
            className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g. Reduce monthly cancellations and convert more trial users to paid'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Business Type</label>
          <select
            value={businessType}
            onChange={(event) => setBusinessType(event.target.value)}
            className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
          >
            <option value=''>Select business type</option>
            <option value='saas'>SaaS / Software Product</option>
            <option value='agency'>Agency (Marketing, Design, IT)</option>
            <option value='consultancy'>Consultancy / Advisory</option>
            <option value='professional_service'>Professional Services (CA, Legal, Compliance)</option>
            <option value='other'>Other</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>GIWI Response Language</label>
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={() => setPreferredLanguage('english')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                preferredLanguage === 'english'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              English
            </button>
            <button
              type='button'
              onClick={() => setPreferredLanguage('hinglish')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                preferredLanguage === 'hinglish'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              Hinglish
            </button>
          </div>
          <p className='text-xs text-gray-400 mt-1'>
            Hinglish uses a natural mix of Hindi and English as used by Indian business professionals.
          </p>
        </div>

        <button
          type='submit'
          disabled={loading}
          className='flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors'
        >
          {loading ? <RefreshCw className='w-4 h-4 animate-spin' /> : <Check className='w-4 h-4' />}
          Save AI Profile
        </button>
      </form>
    </div>
  )
}
