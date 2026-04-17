'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Check, Edit2, PauseCircle, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { PaymentService } from '@/services/paymentService'

// Extended type to include active subscriber count
interface PlanWithActiveCount {
  id: string
  merchant_id: string
  name: string
  description: string
  price: number
  currency: string
  billing_cycle: string
  features: string[]
  is_active: boolean
  subscriber_count: number
  stripe_product_id?: string
  stripe_price_id?: string
  archived_at?: string | null
  created_at: string
  updated_at: string
  active_subscriber_count?: number
  total_subscriber_count?: number
}

export default function PlansPage() {
  const { user, merchant } = useAuth()
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanWithActiveCount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanWithActiveCount | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused' | 'archived'>('all')
  const [archiveModal, setArchiveModal] = useState<{
    open: boolean
    plan: PlanWithActiveCount | null
    loading: boolean
  }>({ open: false, plan: null, loading: false })
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    billing_cycle: 'monthly',
    features: [''],
    trial_period_days: 0,
    billing_type: 'prepaid' as 'prepaid' | 'postpaid',
  })
  const [editFormData, setEditFormData] = useState({
    description: '',
    features: [''],
  })

  // AI badge data — fetched from merchant_ai_context.badge_data
  const [badgeData, setBadgeData] = useState<Record<string, { state: string; tooltip: string }>>({})

  // AI plan suggestion state
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    name: string
    description: string
    price: number
    billing_cycle: string
    trial_period_days: number
    features: string[]
    positioning: string
  }> | null>(null)
  const [aiSuggestError, setAiSuggestError] = useState<string | null>(null)
  const [profileReady, setProfileReady] = useState<boolean | null>(null) // null = not checked yet

  useEffect(() => {
    if (user) {
      loadPlans()
      loadBadgeData()
      checkProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadBadgeData = async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/context', { method: 'POST' })
      if (!res.ok) return
      // Fetch badge_data from merchant_ai_context via the client
      const { data: contextRow } = await supabase
        .from('merchant_ai_context')
        .select('badge_data')
        .eq('merchant_id', user!.id)
        .single()
      if (contextRow?.badge_data) {
        setBadgeData(contextRow.badge_data as Record<string, { state: string; tooltip: string }>)
      }
    } catch {
      // Badge data is non-critical — do not surface errors
    }
  }

  const checkProfile = async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/profile')
      if (res.ok) {
        const data = await res.json() as { data?: { onboarding_completed?: boolean; business_description?: string } | null }
        const ready = !!(data.data?.onboarding_completed && data.data?.business_description)
        setProfileReady(ready)
      } else {
        setProfileReady(false)
      }
    } catch {
      setProfileReady(false)
    }
  }

  const handleGenerateWithAi = async (): Promise<void> => {
    setAiSuggestLoading(true)
    setAiSuggestions(null)
    setAiSuggestError(null)
    try {
      const res = await fetch('/api/ai/suggest-plans', { method: 'POST' })
      const data = await res.json() as {
        data?: Array<{
          name: string
          description: string
          price: number
          billing_cycle: string
          trial_period_days: number
          features: string[]
          positioning: string
        }>
        error?: string
      }
      if (res.ok && data.data) {
        setAiSuggestions(data.data)
      } else {
        setAiSuggestError(data.error ?? 'Failed to generate suggestions. Please try again.')
      }
    } catch {
      setAiSuggestError('AI service temporarily unavailable. Please try again.')
    } finally {
      setAiSuggestLoading(false)
    }
  }

  const applyAiSuggestion = (suggestion: {
    name: string
    description: string
    price: number
    billing_cycle: string
    trial_period_days: number
    features: string[]
  }): void => {
    setFormData({
      name: suggestion.name,
      description: suggestion.description,
      price: String(suggestion.price),
      billing_cycle: suggestion.billing_cycle,
      features: suggestion.features.length > 0 ? suggestion.features : [''],
      trial_period_days: suggestion.trial_period_days,
      billing_type: 'prepaid',
    })
    setAiSuggestions(null)
    setAiSuggestError(null)
  }

  const loadPlans = async () => {
    try {
      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('merchant_id', user!.id)
        .order('created_at', { ascending: false })

      if (plansError) throw plansError

      if (!plansData || plansData.length === 0) {
        setPlans([])
        return
      }

      // Fetch active subscriber counts for all plans
      const planIds = plansData.map(plan => plan.id)
      
      const { data: subscriberCounts, error: countError } = await supabase
        .from('subscribers')
        .select('plan_id')
        .eq('merchant_id', user!.id)
        .eq('status', 'active')
        .in('plan_id', planIds)

      if (countError) throw countError

      // Count active subscribers per plan
      const countMap: { [key: string]: number } = {}
      subscriberCounts?.forEach(sub => {
        countMap[sub.plan_id] = (countMap[sub.plan_id] || 0) + 1
      })

      // Fetch total subscriber counts across ALL statuses (for delete eligibility)
      const { data: totalSubscriberCounts } = await supabase
        .from('subscribers')
        .select('plan_id')
        .eq('merchant_id', user!.id)
        .in('plan_id', planIds)
      // No status filter - counts active + cancelled + failed + pending

      const totalCountMap: { [key: string]: number } = {}
      totalSubscriberCounts?.forEach(sub => {
        totalCountMap[sub.plan_id] = (totalCountMap[sub.plan_id] || 0) + 1
      })

      // Merge counts with plans
      const plansWithCounts = plansData.map(plan => ({
        ...plan,
        active_subscriber_count: countMap[plan.id] || 0,
        total_subscriber_count: totalCountMap[plan.id] || 0,
      }))

      setPlans(plansWithCounts)
    } catch (error) {
      console.error('Error loading plans:', error)
      setPlans([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const planData = {
        merchant_id: user!.id,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        currency: 'INR',
        billing_cycle: formData.billing_cycle,
        features: formData.features.filter((f) => f.trim() !== ''),
        is_active: true,
        trial_period_days: formData.trial_period_days,
        billing_type: formData.billing_type,
      }

      // Create new plan in Supabase
      const { data: newPlan, error } = await supabase
        .from('subscription_plans')
        .insert(planData)
        .select()
        .single()

      if (error) throw error

      // Sync to payment gateway if configured
      const hasGateway = merchant?.stripe_api_key || (merchant as any)?.cashfree_app_id
      if (hasGateway && newPlan) {
        try {
          const paymentService = new PaymentService()
          await paymentService.syncPlan(
            newPlan.id,
            formData.name,
            formData.description,
            parseFloat(formData.price),
            'INR',
            formData.billing_cycle
          )
        } catch (syncError) {
          console.error('Failed to sync plan with payment gateway:', syncError)
          alert('Plan created locally, but failed to sync with payment gateway. Please check your gateway settings.')
        }
      }

      setShowModal(false)
      resetForm()
      loadPlans()
      alert('✅ Plan created successfully!')
    } catch (error: any) {
      console.error('Error saving plan:', error)
      alert('Failed to save plan: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return
    
    setLoading(true)

    try {
      const updateData = {
        description: editFormData.description,
        features: editFormData.features.filter((f) => f.trim() !== ''),
      }

      const { error } = await supabase
        .from('subscription_plans')
        .update(updateData)
        .eq('id', editingPlan.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingPlan(null)
      resetEditForm()
      loadPlans()
      alert('✅ Plan updated successfully!')
    } catch (error: any) {
      console.error('Error updating plan:', error)
      alert('Failed to update plan: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (plan: PlanWithActiveCount) => {
    setEditingPlan(plan)
    setEditFormData({
      description: plan.description || '',
      features: plan.features.length > 0 ? [...plan.features] : [''],
    })
    setShowEditModal(true)
  }

  const toggleActive = async (plan: PlanWithActiveCount) => {
    const newStatus = !plan.is_active
    
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: newStatus })
      .eq('id', plan.id)

    if (error) {
      console.error('Error toggling plan status:', error)
      alert('Failed to update plan status')
    } else {
      loadPlans()
      
      if (newStatus) {
        alert('✅ Plan activated! New subscribers can now sign up for this plan.')
      } else {
        alert('⏸️ Plan paused. New subscriptions are temporarily disabled. Existing subscribers will continue to have access and auto-renew normally.')
      }
    }
  }

  const archivePlan = (plan: PlanWithActiveCount): void => {
    const activeSubs = plan.active_subscriber_count ?? 0
    if (activeSubs > 0) {
      setArchiveModal({ open: true, plan, loading: false })
    } else {
      if (!window.confirm('Archive this plan? This cannot be undone. The plan record is kept permanently for payment history.')) return
      void executeArchive(plan, false)
    }
  }

  const executeArchive = async (plan: PlanWithActiveCount, notifySubscribers: boolean): Promise<void> => {
    setArchiveModal((prev) => ({ ...prev, loading: true }))

    try {
      // Step 1: Notify gateway to archive the plan.
      // manage-plan also sets is_active + archived_at in the DB.
      const hasGateway = merchant?.stripe_api_key || (merchant as any)?.cashfree_app_id
      if (hasGateway) {
        try {
          const paymentService = new PaymentService()
          await paymentService.archivePlan(plan.id)
        } catch (gatewayErr) {
          console.error('Gateway archive failed — continuing with local archive:', gatewayErr)
        }
      } else {
        // No gateway — write directly to DB
        const { error: dbError } = await supabase
          .from('subscription_plans')
          .update({ is_active: false, archived_at: new Date().toISOString() })
          .eq('id', plan.id)

        if (dbError) throw new Error('Failed to archive plan: ' + dbError.message)
      }

      // Step 2: Optionally send migration emails
      if (notifySubscribers) {
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-migration`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({ planId: plan.id }),
          }
        )

        const result = await response.json() as { success: boolean; emailsSent?: number; error?: string }

        if (!result.success) {
          console.error('notify-migration failed:', result.error)
          alert(`Plan archived. However, migration emails could not be sent: ${result.error ?? 'Unknown error'}`)
          setArchiveModal({ open: false, plan: null, loading: false })
          loadPlans()
          return
        }

        alert(`✅ Plan archived. ${result.emailsSent ?? 0} subscriber${(result.emailsSent ?? 0) !== 1 ? 's' : ''} notified to migrate.`)
      } else {
        alert('✅ Plan archived. Existing subscribers will continue billing normally.')
      }

      setArchiveModal({ open: false, plan: null, loading: false })
      loadPlans()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert('Failed to archive plan: ' + msg)
      setArchiveModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const deletePlan = async (plan: PlanWithActiveCount) => {
    const totalSubs = plan.total_subscriber_count ?? 0

    if (totalSubs > 0) {
      alert('Plans with subscriber history cannot be deleted. Use Archive instead — the plan stays as read-only history.')
      return
    }

    if (!window.confirm('Permanently delete this plan? This cannot be undone.')) return

    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', plan.id)

    if (error) {
      alert('Failed to delete plan: ' + error.message)
    } else {
      loadPlans()
    }
  }

  const copyPaymentLink = (plan: PlanWithActiveCount) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/subscribe/${plan.id}`
    navigator.clipboard.writeText(link)
    alert('✅ Payment link copied to clipboard!')
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      billing_cycle: 'monthly',
      features: [''],
      trial_period_days: 0,
      billing_type: 'prepaid',
    })
  }

  const resetEditForm = () => {
    setEditFormData({
      description: '',
      features: [''],
    })
  }

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] })
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features]
    newFeatures[index] = value
    setFormData({ ...formData, features: newFeatures })
  }

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index)
    setFormData({ ...formData, features: newFeatures })
  }

  const addEditFeature = () => {
    setEditFormData({ ...editFormData, features: [...editFormData.features, ''] })
  }

  const updateEditFeature = (index: number, value: string) => {
    const newFeatures = [...editFormData.features]
    newFeatures[index] = value
    setEditFormData({ ...editFormData, features: newFeatures })
  }

  const removeEditFeature = (index: number) => {
    const newFeatures = editFormData.features.filter((_, i) => i !== index)
    setEditFormData({ ...editFormData, features: newFeatures })
  }

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const activePlans = plans.filter(p => p.is_active && !p.archived_at)
  const pausedPlans = plans.filter(p => !p.is_active && !p.archived_at)
  const archivedPlans = plans.filter(p => !!p.archived_at)

  const filteredPlans =
    activeTab === 'all'      ? plans :
    activeTab === 'active'   ? activePlans :
    activeTab === 'paused'   ? pausedPlans :
    archivedPlans

  return (
    <div>
      {/* Payment Gateway Warning */}
      {!merchant?.stripe_api_key && !(merchant as any)?.cashfree_app_id && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Payment gateway not configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To accept payments, please configure Stripe or Cashfree in{' '}
                <a href="/settings" className="underline font-semibold">
                  Settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Manage Subscription Plans</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage your subscription offerings.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Plan
        </button>
      </div>

      {/* Tab filter with count badges */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {([
          { key: 'all', label: 'All', count: plans.length },
          { key: 'active', label: 'Active', count: activePlans.length },
          { key: 'paused', label: 'Paused', count: pausedPlans.length },
          { key: 'archived', label: 'Archived', count: archivedPlans.length },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
            <span className={`px-1.5 py-0.5 text-xs rounded-full font-semibold ${
              activeTab === key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between border-2 transition-all ${
              plan.is_active 
                ? 'border-blue-200 hover:border-blue-300' 
                : 'border-orange-200 bg-orange-50/30'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                    {!plan.is_active && !plan.archived_at && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                        <PauseCircle className="w-3 h-3 mr-1" />
                        Paused
                      </span>
                    )}
                    {badgeData[plan.id] && (
                      <div className="relative group">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-default ${
                          badgeData[plan.id].state === 'growing' ? 'bg-green-100 text-green-700' :
                          badgeData[plan.id].state === 'high_churn' ? 'bg-amber-100 text-amber-700' :
                          badgeData[plan.id].state === 'needs_attention' ? 'bg-red-100 text-red-700' :
                          badgeData[plan.id].state === 'new' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <Sparkles className="w-2.5 h-2.5 mr-1" />
                          {badgeData[plan.id].state === 'growing' && 'Growing'}
                          {badgeData[plan.id].state === 'high_churn' && 'High Churn'}
                          {badgeData[plan.id].state === 'needs_attention' && 'Needs Attention'}
                          {badgeData[plan.id].state === 'new' && 'New'}
                          {badgeData[plan.id].state === 'stable' && 'Stable'}
                        </span>
                        <div className="absolute left-0 top-7 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 shadow-lg">
                          {badgeData[plan.id].tooltip}
                          <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  {plan.stripe_product_id && plan.is_active && !plan.archived_at && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full mt-1">
                      <Check className="w-3 h-3 mr-1" />
                      Active & Synced
                    </span>
                  )}
                  {plan.archived_at && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded-full mt-1">
                      Archived
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  {!plan.archived_at && (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plan.is_active}
                        onChange={() => toggleActive(plan)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  )}
                  <span className="text-xs text-gray-500 mt-1">
                    {plan.archived_at ? 'Archived' : plan.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ₹{plan.price}
                <span className="text-base font-medium text-gray-500">/{plan.billing_cycle}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              <ul className="space-y-3 text-sm text-gray-600 my-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-4 font-medium">
                {plan.active_subscriber_count || 0} Active Subscribers
              </p>
              
              {plan.archived_at ? (
                // Archived - read-only, no actions
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-gray-700">Archived Plan</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Archived {new Date(plan.archived_at).toLocaleDateString()}. Kept for payment history.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plan.is_active && (
                    <>
                      <button
                        onClick={() => openEditModal(plan)}
                        className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-blue-100 flex items-center justify-center transition-colors"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Plan
                      </button>
                      {(merchant?.stripe_api_key || (merchant as any)?.cashfree_app_id) && (
                        <button
                          onClick={() => copyPaymentLink(plan)}
                          className="w-full bg-green-50 text-green-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-green-100 flex items-center justify-center transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Copy Payment Link
                        </button>
                      )}
                    </>
                  )}

                  {!plan.is_active && (
                    <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                      <div className="flex items-start">
                        <PauseCircle className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-orange-800 mb-1">Plan Temporarily Paused</p>
                          <p className="text-xs text-orange-700">
                            New subscribers cannot sign up. Toggle ON to resume.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Archive or Delete depending on subscriber history */}
                  {(plan.total_subscriber_count ?? 0) > 0 ? (
                    <button
                      onClick={() => archivePlan(plan)}
                      className="w-full bg-gray-50 text-gray-600 px-4 py-2 rounded-md font-semibold text-sm hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                      Archive Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => deletePlan(plan)}
                      className="w-full bg-red-50 text-red-600 px-4 py-2 rounded-md font-semibold text-sm hover:bg-red-100 flex items-center justify-center transition-colors"
                    >
                      Delete Plan
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-gray-400 text-5xl mb-4">📋</div>
          {plans.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No plans created yet</h3>
              <p className="text-gray-500 mb-4">Create your first subscription plan to get started</p>
              <button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Plan
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No {activeTab === 'all' ? '' : activeTab} plans
              </h3>
              <p className="text-gray-500">Switch tabs to view other plans.</p>
            </>
          )}
        </div>
      )}

      {/* Quick Tip Section */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-2">Quick Tip</h3>
        <p className="text-sm text-gray-500">
          Copy the payment link and attach it to your subscription button. Your customers can start subscribing right away!
        </p>
      </div>

      {/* Modal for Create Plan */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Create New Plan
              </h2>

              {/* GIWI AI Plan Generation Banner */}
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Generate with GIWI</p>
                      <p className="text-xs text-blue-700">Let AI suggest plans based on your business</p>
                    </div>
                  </div>
                  {profileReady === false ? (
                    <a
                      href="/settings"
                      className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Set up profile first →
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleGenerateWithAi()}
                      disabled={aiSuggestLoading}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {aiSuggestLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Profile not ready message */}
                {profileReady === false && (
                  <div className="border-t border-blue-200 px-4 py-3 bg-white">
                    <p className="text-xs text-gray-600">
                      GIWI needs to know about your business to suggest relevant plans.{' '}
                      <a href="/settings" className="text-blue-600 font-medium hover:underline">
                        Go to Settings → AI Assistant
                      </a>{' '}
                      and fill in your business profile first.
                    </p>
                  </div>
                )}

                {/* Error state */}
                {aiSuggestError && (
                  <div className="border-t border-red-200 px-4 py-3 bg-red-50">
                    <p className="text-xs text-red-700">{aiSuggestError}</p>
                  </div>
                )}

                {/* Loading skeleton */}
                {aiSuggestLoading && (
                  <div className="border-t border-blue-200 px-4 py-4 space-y-3 bg-white">
                    <p className="text-xs text-gray-500 mb-2">GIWI is designing plans for your business...</p>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {aiSuggestions && !aiSuggestLoading && (
                  <div className="border-t border-blue-200 bg-white">
                    <p className="text-xs text-gray-500 px-4 pt-3 pb-2">
                      Select a plan to populate the form. You can edit any field before creating.
                    </p>
                    <div className="space-y-2 px-4 pb-4">
                      {aiSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applyAiSuggestion(suggestion)}
                          className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                              {suggestion.name}
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              ₹{suggestion.price}/{suggestion.billing_cycle}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1.5">{suggestion.positioning}</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.features.slice(0, 3).map((f, fi) => (
                              <span key={fi} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {f}
                              </span>
                            ))}
                            {suggestion.features.length > 3 && (
                              <span className="text-xs text-gray-400">+{suggestion.features.length - 3} more</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Premium Plan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Describe what's included in this plan"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="299.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Billing Cycle
                    </label>
                    <select
                      value={formData.billing_cycle}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_cycle: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
                {/* Trial Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trial Period <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { label: 'No Trial', days: 0 },
                      { label: '7 Days', days: 7 },
                      { label: '15 Days', days: 15 },
                      { label: '1 Month', days: 30 },
                      { label: '3 Months', days: 90 },
                      { label: '6 Months', days: 180 },
                    ].map((option) => (
                      <button
                        key={option.days}
                        type="button"
                        onClick={() => setFormData({ ...formData, trial_period_days: option.days })}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          formData.trial_period_days === option.days
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={formData.trial_period_days}
                      onChange={(e) =>
                        setFormData({ ...formData, trial_period_days: parseInt(e.target.value) || 0 })
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-500">custom days</span>
                  </div>
                  {formData.trial_period_days > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      First charge on day {formData.trial_period_days + 1} after subscription starts
                    </p>
                  )}
                </div>

                {/* Billing Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Type
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billing_type: 'prepaid' })}
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formData.billing_type === 'prepaid'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">Prepaid</div>
                      <div className="text-xs font-normal opacity-75">Charge at start of cycle</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billing_type: 'postpaid' })}
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formData.billing_type === 'postpaid'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">Postpaid</div>
                      <div className="text-xs font-normal opacity-75">Charge at end of cycle</div>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Feature description"
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFeature}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Edit Plan */}
      {showEditModal && editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Edit Plan: {editingPlan.name}
              </h2>
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Note:</span> You can only edit the description and features. Plan name, price, and billing cycle cannot be changed.
                </p>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Describe what's included in this plan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                  {editFormData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateEditFeature(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Feature description"
                      />
                      {editFormData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditFeature(index)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEditFeature}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingPlan(null)
                      resetEditForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Archive Options Modal */}
      {archiveModal.open && archiveModal.plan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Archive &quot;{archiveModal.plan.name}&quot;</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This plan has{' '}
                  <strong>{archiveModal.plan.active_subscriber_count ?? 0} active subscriber{(archiveModal.plan.active_subscriber_count ?? 0) !== 1 ? 's' : ''}</strong>.
                  Choose what happens to them.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <button
                type="button"
                onClick={() => { if (!archiveModal.loading) void executeArchive(archiveModal.plan!, false) }}
                disabled={archiveModal.loading}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-semibold text-gray-900 text-sm mb-1">Keep them active</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Existing subscribers stay on this plan and billing continues normally until
                  they cancel themselves. No emails are sent.
                </p>
              </button>

              <button
                type="button"
                onClick={() => { if (!archiveModal.loading) void executeArchive(archiveModal.plan!, true) }}
                disabled={archiveModal.loading}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-semibold text-gray-900 text-sm mb-1">Notify subscribers to migrate</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Each subscriber receives an email telling them their plan ends at their next
                  billing date, with links to your available plans. If they do not switch,
                  their subscription ends then.
                </p>
              </button>
            </div>

            {archiveModal.loading && (
              <div className="flex items-center justify-center mb-4 text-sm text-gray-500">
                <svg className="animate-spin w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processing...
              </div>
            )}

            <button
              type="button"
              onClick={() => { if (!archiveModal.loading) setArchiveModal({ open: false, plan: null, loading: false }) }}
              disabled={archiveModal.loading}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
