'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Filter, Download, FileText } from 'lucide-react'
import { generateInvoicePDF, formatInvoiceDate } from '@/utils/pdfInvoiceGenerator'

interface PaymentTransaction {
  id: string
  amount: number
  status: 'success' | 'failed' | 'pending'
  payment_date: string
  stripe_payment_id?: string
  subscriber: {
    customer_name: string
    customer_email: string
  }
  plan: {
    name: string
  }
}

export default function PaymentsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<string[]>([])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (user) {
      loadTransactions()
    }
  }, [user])

  useEffect(() => {
    filterTransactions()
  }, [searchQuery, statusFilter, planFilter, transactions])

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(
          `
          id,
          amount,
          status,
          payment_date,
          stripe_payment_id,
          subscribers (
            customer_name,
            customer_email
          ),
          subscription_plans (
            name
          )
        `
        )
        .eq('merchant_id', user!.id)
        .order('payment_date', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((tx: any) => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        payment_date: tx.payment_date,
        stripe_payment_id: tx.stripe_payment_id,
        subscriber: {
          customer_name: tx.subscribers?.customer_name || 'Unknown',
          customer_email: tx.subscribers?.customer_email || '',
        },
        plan: {
          name: tx.subscription_plans?.name || 'Unknown Plan',
        },
      }))

      setTransactions(formatted)
      setFilteredTransactions(formatted)

      // Extract unique plan names for filter
      const uniquePlans = Array.from(
        new Set(formatted.map((tx) => tx.plan.name))
      ).sort()
      setAvailablePlans(uniquePlans)
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTransactions = () => {
    let filtered = [...transactions]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (tx) =>
          tx.subscriber.customer_name.toLowerCase().includes(query) ||
          tx.subscriber.customer_email.toLowerCase().includes(query) ||
          tx.stripe_payment_id?.toLowerCase().includes(query) ||
          generateInvoiceId(tx.id).toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.status === statusFilter)
    }

    // Plan filter
    if (planFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.plan.name === planFilter)
    }

    setFilteredTransactions(filtered)
    setCurrentPage(1)
  }

  const generateInvoiceId = (txId: string) => {
    const shortId = txId.substring(0, 8).toUpperCase()
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    return `INV-${date.substring(2)}-${shortId}`
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      success: { color: 'text-green-600', bg: 'bg-green-500' },
      failed: { color: 'text-red-600', bg: 'bg-red-500' },
      pending: { color: 'text-yellow-600', bg: 'bg-yellow-500' },
    }
    return badges[status as keyof typeof badges] || badges.pending
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const downloadInvoice = async (transaction: PaymentTransaction) => {
    try {
      // Fetch merchant details from Supabase
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('business_name, email, phone, bank_account, gst_number, logo_url')
        .eq('id', user!.id)
        .single()

      if (merchantError) {
        console.error('Error fetching merchant data:', merchantError)
      }

      // Prepare invoice data for PDF generator
      const invoiceData = {
        invoiceId: generateInvoiceId(transaction.id),
        invoiceDate: formatInvoiceDate(transaction.payment_date),
        dueDate: formatInvoiceDate(transaction.payment_date),
        
        // Merchant Info - use fetched data or defaults
        merchantName: merchantData?.business_name || 'Your Business Name',
        merchantEmail: merchantData?.email || user?.email || 'contact@yourbusiness.com',
        merchantAddress: merchantData?.bank_account || undefined,
        merchantGST: merchantData?.gst_number || undefined,
        merchantPhone: merchantData?.phone || undefined,
        merchantLogo: merchantData?.logo_url || undefined,
        
        // Customer Info
        customerName: transaction.subscriber.customer_name,
        customerEmail: transaction.subscriber.customer_email,
        
        // Payment Info (Amount in INR)
        planName: transaction.plan.name,
        planDescription: 'Subscription Service',
        amount: transaction.amount,
        currency: '₹',
        status: transaction.status,
        
        // Additional Info
        paymentMethod: 'Stripe',
        transactionId: transaction.stripe_payment_id || transaction.id,
        billingCycle: 'Monthly',
      }

      // Generate and download PDF
      await generateInvoicePDF(invoiceData)
      
    } catch (error) {
      console.error('Error generating invoice:', error)
      alert('Failed to generate invoice. Please try again.')
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Invoice ID',
      'Customer',
      'Email',
      'Date',
      'Amount',
      'Status',
      'Plan',
    ]
    const rows = filteredTransactions.map((tx) => [
      generateInvoiceId(tx.id),
      tx.subscriber.customer_name,
      tx.subscriber.customer_email,
      formatDate(tx.payment_date),
      `₹${tx.amount.toFixed(2)}`,
      tx.status,
      tx.plan.name,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className='bg-white p-6 rounded-xl shadow-sm'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b'>
        <div>
          <h2 className='text-xl font-semibold text-gray-700'>
            Payment History
          </h2>
          <p className='text-sm text-gray-500 mt-1'>
            Track and manage all your transactions (
            {filteredTransactions.length} total)
          </p>
        </div>

        {/* Search and Actions */}
        <div className='flex items-center space-x-2 mt-4 md:mt-0'>
          {/* Search */}
          <div className='relative'>
            <input
              type='text'
              placeholder='Search by invoice ID or name...'
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
              {(statusFilter !== 'all' || planFilter !== 'all') && (
                <span className='ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full'>
                  {(statusFilter !== 'all' ? 1 : 0) + (planFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {showFilterMenu && (
              <div className='absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20 border'>
                <div className='p-3'>
                  {/* Status Filter Section */}
                  <div className='mb-3'>
                    <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>
                      Status
                    </p>
                    <div className='space-y-1'>
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`block w-full text-left px-3 py-2 rounded text-sm ${
                          statusFilter === 'all'
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        All Status
                      </button>
                      <button
                        onClick={() => setStatusFilter('success')}
                        className={`block w-full text-left px-3 py-2 rounded text-sm ${
                          statusFilter === 'success'
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        Success
                      </button>
                      <button
                        onClick={() => setStatusFilter('pending')}
                        className={`block w-full text-left px-3 py-2 rounded text-sm ${
                          statusFilter === 'pending'
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        Pending
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className='border-t border-gray-200 my-3'></div>

                  {/* Plan Filter Section */}
                  <div>
                    <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>
                      Plan
                    </p>
                    <div className='space-y-1 max-h-48 overflow-y-auto'>
                      <button
                        onClick={() => setPlanFilter('all')}
                        className={`block w-full text-left px-3 py-2 rounded text-sm ${
                          planFilter === 'all'
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        All Plans
                      </button>
                      {availablePlans.map((plan) => (
                        <button
                          key={plan}
                          onClick={() => setPlanFilter(plan)}
                          className={`block w-full text-left px-3 py-2 rounded text-sm ${
                            planFilter === plan
                              ? 'bg-blue-50 text-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clear All Filters */}
                  {(statusFilter !== 'all' || planFilter !== 'all') && (
                    <>
                      <div className='border-t border-gray-200 my-3'></div>
                      <button
                        onClick={() => {
                          setStatusFilter('all')
                          setPlanFilter('all')
                          setShowFilterMenu(false)
                        }}
                        className='block w-full text-center px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50'
                      >
                        Clear All Filters
                      </button>
                    </>
                  )}
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
      ) : filteredTransactions.length === 0 ? (
        <div className='text-center py-12'>
          <FileText className='w-16 h-16 text-gray-300 mx-auto mb-4' />
          <p className='text-gray-500 text-lg font-medium'>
            No transactions found
          </p>
          <p className='text-gray-400 text-sm mt-1'>
            Payment transactions will appear here once subscribers make
            payments
          </p>
          {searchQuery || statusFilter !== 'all' || planFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setPlanFilter('all')
              }}
              className='mt-4 text-blue-600 hover:text-blue-700 text-sm'
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
                    Invoice ID
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Customer
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Date
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Amount
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Status
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    Plan
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    <span className='sr-only'>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentTransactions.map((transaction) => {
                  const badge = getStatusBadge(transaction.status)
                  return (
                    <tr
                      key={transaction.id}
                      className='bg-white border-b hover:bg-gray-50'
                    >
                      <td className='px-6 py-4 font-mono text-gray-700'>
                        {generateInvoiceId(transaction.id)}
                      </td>
                      <td className='px-6 py-4'>
                        <div className='font-medium text-gray-900'>
                          {transaction.subscriber.customer_name}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        {formatDate(transaction.payment_date)}
                      </td>
                      <td className='px-6 py-4 font-medium'>
                        ₹{transaction.amount.toFixed(2)}
                      </td>
                      <td className='px-6 py-4'>
                        <span className={`flex items-center ${badge.color}`}>
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${badge.bg} mr-2`}
                          ></div>
                          {transaction.status.charAt(0).toUpperCase() +
                            transaction.status.slice(1)}
                        </span>
                      </td>
                      <td className='px-6 py-4'>{transaction.plan.name}</td>
                      <td className='px-6 py-4 text-right'>
                        {transaction.status === 'success' ? (
                          <button
                            onClick={() => downloadInvoice(transaction)}
                            className='text-blue-600 hover:text-blue-800 font-medium'
                          >
                            Download
                          </button>
                        ) : transaction.status === 'failed' ? (
                          <button className='text-gray-400 cursor-not-allowed font-medium'>
                            Failed
                          </button>
                        ) : (
                          <button className='text-yellow-600 hover:text-yellow-800 font-medium'>
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex justify-between items-center mt-4'>
              <span className='text-sm text-gray-600'>
                Showing {startIndex + 1} to{' '}
                {Math.min(endIndex, filteredTransactions.length)} of{' '}
                {filteredTransactions.length} results
              </span>
              <div className='flex items-center space-x-1'>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className='px-3 py-1 border rounded-md hover:bg-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Previous
                </button>

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