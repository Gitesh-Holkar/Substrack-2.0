'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Filter, Download, X, AlertTriangle } from 'lucide-react'

type SubscriberStatus = 'active' | 'cancelled' | 'failed' | 'past_due' | 'pending'

interface SubscriberWithPlan {
  id: string
  customer_name: string
  customer_email: string
  status: SubscriberStatus
  start_date: string
  next_renewal_date: string | null
  last_payment_amount: number | null
  last_payment_date: string | null
  plan_name: string
  plan_id: string
  plan_price: number
  plan_billing_type: string
  plan_trial_period_days: number
  payment_provider: string
  dunning_step: number
}

interface PlanOption {
  id: string
  name: string
}

function SubscribersPageInner() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [subscribers, setSubscribers] = useState<SubscriberWithPlan[]>([])
  const [filteredSubscribers, setFilteredSubscribers] = useState<SubscriberWithPlan[]>([])
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (user) loadSubscribers()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterSubscribers()
  }, [searchQuery, statusFilter, planFilter, billingTypeFilter, providerFilter, dateFrom, dateTo, subscribers]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSubscribers = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('subscribers')
        .select(`
          id,
          customer_name,
          customer_email,
          status,
          start_date,
          next_renewal_date,
          last_payment_amount,
          last_payment_date,
          payment_provider,
          dunning_step,
          plan_id,
          subscription_plans!plan_id (
            id,
            name,
            price,
            billing_type,
            trial_period_days
          )
        `)
        .eq('merchant_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted: SubscriberWithPlan[] = (data ?? []).map((sub: any) => ({
        id: sub.id,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        status: sub.status as SubscriberStatus,
        start_date: sub.start_date,
        next_renewal_date: sub.next_renewal_date,
        last_payment_amount: sub.last_payment_amount,
        last_payment_date: sub.last_payment_date,
        plan_name: sub.subscription_plans?.name ?? 'Unknown Plan',
        plan_id: sub.plan_id,
        plan_price: sub.subscription_plans?.price ?? 0,
        plan_billing_type: sub.subscription_plans?.billing_type ?? 'prepaid',
        plan_trial_period_days: sub.subscription_plans?.trial_period_days ?? 0,
        payment_provider: sub.payment_provider ?? 'stripe',
        dunning_step: sub.dunning_step ?? 0,
      }))

      setSubscribers(formatted)
      setFilteredSubscribers(formatted)

      const seen = new Set<string>()
      const options: PlanOption[] = []
      formatted.forEach((s) => {
        if (!seen.has(s.plan_id)) {
          seen.add(s.plan_id)
          options.push({ id: s.plan_id, name: s.plan_name })
        }
      })
      setPlanOptions(options)
    } catch (err) {
      console.error('Error loading subscribers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterSubscribers = (): void => {
    let filtered = [...subscribers]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.customer_name.toLowerCase().includes(q) ||
          s.customer_email.toLowerCase().includes(q) ||
          s.plan_name.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') filtered = filtered.filter((s) => s.status === statusFilter)
    if (planFilter !== 'all') filtered = filtered.filter((s) => s.plan_id === planFilter)
    if (billingTypeFilter !== 'all') filtered = filtered.filter((s) => s.plan_billing_type === billingTypeFilter)
    if (providerFilter !== 'all') filtered = filtered.filter((s) => s.payment_provider === providerFilter)
    if (dateFrom) filtered = filtered.filter((s) => new Date(s.start_date) >= new Date(dateFrom))
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter((s) => new Date(s.start_date) <= to)
    }
    setFilteredSubscribers(filtered)
    setCurrentPage(1)
  }

  const clearAllFilters = (): void => {
    setStatusFilter('all')
    setPlanFilter('all')
    setBillingTypeFilter('all')
    setProviderFilter('all')
    setDateFrom('')
    setDateTo('')
    setSearchQuery('')
    router.replace('/subscribers')
  }

  const activeFilterCount = [
    statusFilter !== 'all',
    planFilter !== 'all',
    billingTypeFilter !== 'all',
    providerFilter !== 'all',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length

  const STATUS_BADGE: Record<SubscriberStatus, string> = {
    active: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
    failed: 'bg-red-100 text-red-800',
    past_due: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }

  const STATUS_LABEL: Record<SubscriberStatus, string> = {
    active: 'Active',
    cancelled: 'Cancelled',
    failed: 'Failed',
    past_due: 'Past Due',
    pending: 'Pending',
  }

  const getDunningLabel = (step: number): string => {
    if (step === 1) return 'Reminder 1 of 3 sent'
    if (step === 2) return 'Reminder 2 of 3 sent'
    if (step === 3) return 'Final reminder sent — cancelling soon'
    return ''
  }

  const formatDate = (d: string | null): string => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const exportToCSV = (): void => {
    const headers = ['Customer Name', 'Email', 'Plan', 'Status', 'Provider', 'Start Date', 'Next Billing', 'Last Payment']
    const rows = filteredSubscribers.map((s) => [
      s.customer_name, s.customer_email, s.plan_name, s.status, s.payment_provider,
      formatDate(s.start_date), formatDate(s.next_renewal_date),
      s.last_payment_amount != null ? `Rs${s.last_payment_amount.toFixed(2)}` : '-',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage)
  const currentSubscribers = filteredSubscribers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const pastDueSubs = subscribers.filter((s) => s.status === 'past_due')
  const pastDueTotal = pastDueSubs.reduce((sum, s) => sum + (s.last_payment_amount ?? 0), 0)

  return (
    <div className='bg-white p-6 rounded-xl shadow-sm'>
      {pastDueSubs.length > 0 && (
        <div className='mb-4 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3'>
          <AlertTriangle className='w-5 h-5 text-orange-600 flex-shrink-0' />
          <div>
            <span className='text-sm font-semibold text-orange-800'>Revenue at Risk: </span>
            <span className='text-sm text-orange-700'>
              &#8377;{pastDueTotal.toFixed(2)} across {pastDueSubs.length} subscriber{pastDueSubs.length !== 1 ? 's' : ''} in payment recovery
            </span>
          </div>
        </div>
      )}

      <div className='flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b'>
        <div>
          <h2 className='text-xl font-semibold text-gray-700'>All Subscribers</h2>
          <p className='text-sm text-gray-500 mt-1'>Manage your customer subscriptions ({filteredSubscribers.length} total)</p>
        </div>
        <div className='flex items-center gap-2 mt-4 md:mt-0'>
          <div className='relative'>
            <input
              type='text'
              placeholder='Search subscribers...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
            />
            <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
          </div>

          <div className='relative'>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm'
            >
              <Filter className='w-4 h-4 mr-2' />
              Filters
              {activeFilterCount > 0 && (
                <span className='ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full min-w-[18px] text-center'>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilterPanel && (
              <div className='absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl z-30 border border-gray-200 p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <span className='text-sm font-semibold text-gray-700'>Filters</span>
                  <button onClick={() => setShowFilterPanel(false)}>
                    <X className='w-4 h-4 text-gray-400 hover:text-gray-600' />
                  </button>
                </div>

                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'>Status</label>
                  <div className='flex flex-wrap gap-1.5'>
                    {(['all', 'active', 'past_due', 'cancelled', 'failed', 'pending'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {s === 'all' ? 'All' : s === 'past_due' ? 'Past Due' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'>Plan</label>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className='w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value='all'>All Plans</option>
                    {planOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'>Start Date</label>
                  <div className='flex gap-2'>
                    <input type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className='flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                    <input type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} className='flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </div>
                </div>

                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'>Billing Type</label>
                  <div className='flex gap-1.5'>
                    {(['all', 'prepaid', 'postpaid'] as const).map((t) => (
                      <button key={t} onClick={() => setBillingTypeFilter(t)} className={`flex-1 py-1 rounded-full text-xs font-medium transition-colors ${billingTypeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'>Provider</label>
                  <div className='flex gap-1.5'>
                    {(['all', 'stripe', 'cashfree'] as const).map((p) => (
                      <button key={p} onClick={() => setProviderFilter(p)} className={`flex-1 py-1 rounded-full text-xs font-medium transition-colors ${providerFilter === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { clearAllFilters(); setShowFilterPanel(false) }}
                    className='w-full text-sm text-red-600 hover:text-red-700 font-medium py-1.5 border-t border-gray-100 pt-3 mt-1'
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={exportToCSV} className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm'>
            <Download className='w-4 h-4 mr-2' />
            Export
          </button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className='flex flex-wrap gap-2 mt-3'>
          {statusFilter !== 'all' && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              {statusFilter === 'past_due' ? 'Past Due' : statusFilter}
              <button onClick={() => setStatusFilter('all')}><X className='w-3 h-3' /></button>
            </span>
          )}
          {planFilter !== 'all' && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              {planOptions.find((p) => p.id === planFilter)?.name ?? 'Plan'}
              <button onClick={() => setPlanFilter('all')}><X className='w-3 h-3' /></button>
            </span>
          )}
          {billingTypeFilter !== 'all' && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              {billingTypeFilter}
              <button onClick={() => setBillingTypeFilter('all')}><X className='w-3 h-3' /></button>
            </span>
          )}
          {providerFilter !== 'all' && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              {providerFilter}
              <button onClick={() => setProviderFilter('all')}><X className='w-3 h-3' /></button>
            </span>
          )}
          {dateFrom && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              From {dateFrom}<button onClick={() => setDateFrom('')}><X className='w-3 h-3' /></button>
            </span>
          )}
          {dateTo && (
            <span className='flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium'>
              To {dateTo}<button onClick={() => setDateTo('')}><X className='w-3 h-3' /></button>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className='flex justify-center items-center py-12'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className='text-center py-12'>
          <p className='text-gray-500'>No subscribers found</p>
          {(activeFilterCount > 0 || searchQuery) && (
            <button onClick={clearAllFilters} className='mt-2 text-blue-600 hover:text-blue-700 text-sm'>Clear all filters</button>
          )}
        </div>
      ) : (
        <>
          <div className='overflow-x-auto mt-4'>
            <table className='w-full text-sm text-left text-gray-500'>
              <thead className='text-xs text-gray-700 uppercase bg-gray-50'>
                <tr>
                  <th className='px-6 py-3'>Customer</th>
                  <th className='px-6 py-3'>Plan</th>
                  <th className='px-6 py-3'>Status</th>
                  <th className='px-6 py-3'>Start Date</th>
                  <th className='px-6 py-3'>Next Billing</th>
                  <th className='px-6 py-3'>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {currentSubscribers.map((sub) => (
                  <tr key={sub.id} className='bg-white border-b hover:bg-gray-50'>
                    <td className='px-6 py-4'>
                      <div className='font-medium text-gray-900'>{sub.customer_name}</div>
                      <div className='text-xs text-gray-500'>{sub.customer_email}</div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='font-medium text-gray-800'>{sub.plan_name}</div>
                      <div className='text-xs text-gray-400 capitalize'>{sub.payment_provider} · {sub.plan_billing_type}</div>
                    </td>
                    <td className='px-6 py-4'>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_BADGE[sub.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                      {sub.status === 'past_due' && sub.dunning_step > 0 && (
                        <div className='text-xs text-orange-600 mt-1 font-medium'>{getDunningLabel(sub.dunning_step)}</div>
                      )}
                    </td>
                    <td className='px-6 py-4'>{formatDate(sub.start_date)}</td>
                    <td className='px-6 py-4'>{formatDate(sub.next_renewal_date)}</td>
                    <td className='px-6 py-4'>{sub.last_payment_amount != null ? `₹${sub.last_payment_amount.toFixed(2)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className='flex justify-between items-center mt-4 pt-4 border-t'>
              <p className='text-sm text-gray-500'>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredSubscribers.length)} of {filteredSubscribers.length}
              </p>
              <div className='flex gap-2'>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className='px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50'>Previous</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className='px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50'>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SubscribersPage() {
  return (
    <Suspense fallback={<div className='flex justify-center items-center h-64'><div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' /></div>}>
      <SubscribersPageInner />
    </Suspense>
  )
}
