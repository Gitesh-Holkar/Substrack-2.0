'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Check, Edit2, PauseCircle, ExternalLink } from 'lucide-react'

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
  created_at: string
  updated_at: string
  active_subscriber_count?: number
}

export default function PlansPage() {
  const { user, merchant } = useAuth()
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanWithActiveCount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanWithActiveCount | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    billing_cycle: 'monthly',
    features: [''],
  })
  const [editFormData, setEditFormData] = useState({
    description: '',
    features: [''],
  })

  useEffect(() => {
    if (user) {
      loadPlans()
    }
  }, [user])

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

      // Merge counts with plans
      const plansWithCounts = plansData.map(plan => ({
        ...plan,
        active_subscriber_count: countMap[plan.id] || 0
      }))

      setPlans(plansWithCounts)
    } catch (error) {
      console.error('Error loading plans:', error)
      setPlans([])
    } finally {
      setLoading(false)
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
      }

      const { error } = await supabase
        .from('subscription_plans')
        .insert(planData)
        .select()
        .single()

      if (error) throw error

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

  return (
    <div>
      {/* Stripe Warning */}
      {!merchant?.stripe_api_key && (
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
              <h3 className="text-sm font-medium text-yellow-800">Stripe not configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To accept payments, please configure your Stripe API keys in{' '}
                <a href="/settings" className="underline font-semibold">
                  Settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Manage Subscription Plans</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage your subscription offerings. Use the toggle to pause/resume new subscriptions.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                    {!plan.is_active && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                        <PauseCircle className="w-3 h-3 mr-1" />
                        Paused
                      </span>
                    )}
                  </div>
                  {plan.stripe_product_id && plan.is_active && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full mt-1">
                      <Check className="w-3 h-3 mr-1" />
                      Active & Synced
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={() => toggleActive(plan)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-xs text-gray-500 mt-1">
                    {plan.is_active ? 'Active' : 'Paused'}
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
              
              {/* Show Edit Button and Payment Link or Paused Message */}
              {plan.is_active ? (
                <div className="space-y-2">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-blue-100 flex items-center justify-center transition-colors"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Plan
                  </button>
                  {plan.stripe_price_id && merchant?.stripe_api_key && (
                    <button
                      onClick={() => copyPaymentLink(plan)}
                      className="w-full bg-green-50 text-green-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-green-100 flex items-center justify-center transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Copy Payment Link
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <div className="flex items-start">
                    <PauseCircle className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-800 mb-1">
                        Plan Temporarily Paused
                      </p>
                      <p className="text-xs text-orange-700">
                        New subscribers cannot sign up. Existing subscribers continue with normal access and auto-renewal.
                      </p>
                      <p className="text-xs text-orange-600 mt-2 font-medium">
                        Toggle ON to allow new subscriptions
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-gray-400 text-5xl mb-4">📋</div>
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
    </div>
  )
}