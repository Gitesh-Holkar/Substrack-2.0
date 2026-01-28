'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Filter, Download } from 'lucide-react'

// Define proper types
interface SubscriberWithPlan {
  id: string
  customer_name: string
  customer_email: string
  status: 'active' | 'cancelled' | 'failed'
  start_date: string
  next_renewal_date: string | null
  last_payment_amount: number | null
  last_payment_date: string | null
  plan_name: string
  plan_price: number
}

export default function SubscribersPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [subscribers, setSubscribers] = useState<SubscriberWithPlan[]>([])
  const [filteredSubscribers, setFilteredSubscribers] = useState<SubscriberWithPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (user) {
      loadSubscribers()
    }
  }, [user])

  useEffect(() => {
    filterSubscribers()
  }, [searchQuery, statusFilter, subscribers])

  const loadSubscribers = async () => {
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
          subscription_plans (
            name,
            price
          )
        `)
        .eq('merchant_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data with proper type handling
      const formatted: SubscriberWithPlan[] = (data || []).map((sub: any) => ({
        id: sub.id,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        status: sub.status as 'active' | 'cancelled' | 'failed',
        start_date: sub.start_date,
        next_renewal_date: sub.next_renewal_date,
        last_payment_amount: sub.last_payment_amount,
        last_payment_date: sub.last_payment_date,
        plan_name: sub.subscription_plans?.name || 'Unknown Plan',
        plan_price: sub.subscription_plans?.price || 0,
      }))

      setSubscribers(formatted)
      setFilteredSubscribers(formatted)
    } catch (error) {
      console.error('Error loading subscribers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSubscribers = () => {
    let filtered = [...subscribers]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (sub) =>
          sub.customer_name.toLowerCase().includes(query) ||
          sub.customer_email.toLowerCase().includes(query) ||
          sub.plan_name.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.status === statusFilter)
    }

    setFilteredSubscribers(filtered)
    setCurrentPage(1) // Reset to first page when filtering
  }

  const getStatusBadge = (status: 'active' | 'cancelled' | 'failed') => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
    }
    return badges[status]
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const exportToCSV = () => {
    const headers = [
      'Customer Name',
      'Email',
      'Plan',
      'Status',
      'Start Date',
      'Next Billing',
    ]
    const rows = filteredSubscribers.map((sub) => [
      sub.customer_name,
      sub.customer_email,
      sub.plan_name,
      sub.status,
      formatDate(sub.start_date),
      formatDate(sub.next_renewal_date),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentSubscribers = filteredSubscribers.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className='bg-white p-6 rounded-xl shadow-sm'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b'>
        <div>
          <h2 className='text-xl font-semibold text-gray-700'>
            All Subscribers
          </h2>
          <p className='text-sm text-gray-500 mt-1'>
            Manage your customer subscriptions ({filteredSubscribers.length}{' '}
            total)
          </p>
        </div>

        {/* Search and Actions */}
        <div className='flex items-center space-x-2 mt-4 md:mt-0'>
          {/* Search */}
          <div className='relative'>
            <input
              type='text'
              placeholder='Search subscribers...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <Search className='w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
          </div>

          {/* Filter Button */}
          <div className='relative'>
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm'
            >
              <Filter className='w-4 h-4 mr-2' />
              Filter
            </button>

            {showFilterMenu && (
              <div className='absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 border'>
                <div className='p-2'>
                  <button
                    onClick={() => {
                      setStatusFilter('all')
                      setShowFilterMenu(false)
                    }}
                    className={`block w-full text-left px-3 py-2 rounded text-sm ${
                      statusFilter === 'all'
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('active')
                      setShowFilterMenu(false)
                    }}
                    className={`block w-full text-left px-3 py-2 rounded text-sm ${
                      statusFilter === 'active'
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('cancelled')
                      setShowFilterMenu(false)
                    }}
                    className={`block w-full text-left px-3 py-2 rounded text-sm ${
                      statusFilter === 'cancelled'
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    Cancelled
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm'
          >
            <Download className='w-4 h-4 mr-2' />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className='flex justify-center items-center py-12'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className='text-center py-12'>
          <p className='text-gray-500'>No subscribers found</p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className='mt-2 text-blue-600 hover:text-blue-700 text-sm'
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className='overflow-x-auto mt-4'>
            <table className='w-full text-sm text-left text-gray-500'>
              <thead className='text-xs text-gray-700 uppercase bg-gray-50'>
                <tr>
                  <th scope='col' className='px-6 py-3'>
                    Customer
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Plan
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Status
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Start Date
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Next Billing
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Last Payment
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentSubscribers.map((subscriber) => (
                  <tr
                    key={subscriber.id}
                    className='bg-white border-b hover:bg-gray-50'
                  >
                    <td className='px-6 py-4'>
                      <div className='font-medium text-gray-900'>
                        {subscriber.customer_name}
                      </div>
                      <div className='text-xs text-gray-500'>
                        {subscriber.customer_email}
                      </div>
                    </td>
                    <td className='px-6 py-4 font-medium'>
                      {subscriber.plan_name}
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                          subscriber.status
                        )}`}
                      >
                        {subscriber.status.charAt(0).toUpperCase() +
                          subscriber.status.slice(1)}
                      </span>
                    </td>
                    <td className='px-6 py-4'>
                      {formatDate(subscriber.start_date)}
                    </td>
                    <td className='px-6 py-4'>
                      {formatDate(subscriber.next_renewal_date)}
                    </td>
                    <td className='px-6 py-4'>
                      {subscriber.last_payment_amount ? (
                        <div>
                          <div className='font-medium'>
                            ₹{subscriber.last_payment_amount.toFixed(2)}
                          </div>
                          <div className='text-xs text-gray-500'>
                            {formatDate(subscriber.last_payment_date)}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex justify-between items-center mt-4'>
              <span className='text-sm text-gray-600'>
                Showing {startIndex + 1} to{' '}
                {Math.min(endIndex, filteredSubscribers.length)} of{' '}
                {filteredSubscribers.length} results
              </span>
              <div className='flex items-center space-x-1'>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className='px-3 py-1 border rounded-md hover:bg-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Previous
                </button>

                {/* Page numbers */}
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = idx + 1
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + idx
                  } else {
                    pageNum = currentPage - 2 + idx
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1 border rounded-md text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className='px-3 py-1 text-sm'>...</span>
                    <button
                      onClick={() => goToPage(totalPages)}
                      className='px-3 py-1 border rounded-md hover:bg-gray-100 text-sm'
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className='px-3 py-1 border rounded-md hover:bg-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}