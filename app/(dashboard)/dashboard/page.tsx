'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  Users,
  Calendar,
  TrendingDown,
  TrendingUp,
  Minus,
  Download,
  RefreshCw,
  Wallet,
  CreditCard,
  UserCheck,
  Activity,  
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DashboardStats {
  totalRevenue: number
  revenueGrowth: number
  activeSubscribers: number
  subscriberGrowth: number
  upcomingRenewals: number  
  churnRate: number          
  mrr: number                
  arr: number                
  mrrGrowth: number          
  arrGrowth: number          
  monthlyRevenue: number
  monthlyRevenueGrowth: number
}
interface RecentActivity {
  id: string
  customer_name: string
  plan_name: string
  date: string
  amount: number
  status: string
}

interface RevenueChartData {
  month: string
  revenue: number
}

interface SubscriberChartData {
  month: string
  newSubscribers: number
  churned: number
}

interface RevenueByPlanData {
  planName: string
  revenue: number
  subscribers: number
}

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
]

export default function DashboardPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    revenueGrowth: 0,
    activeSubscribers: 0,
    subscriberGrowth: 0,
    upcomingRenewals: 0,
    churnRate: 0,
    mrr: 0,
    arr: 0,
    mrrGrowth: 0,
    arrGrowth: 0,
    monthlyRevenue: 0,
    monthlyRevenueGrowth: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>([])
  const [subscriberChartData, setSubscriberChartData] = useState<SubscriberChartData[]>([])
  const [revenueByPlanData, setRevenueByPlanData] = useState<RevenueByPlanData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '6m' | '1y'>('6m')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, dateRange])

  const loadDashboardData = async () => {
    try {
      const rangeDate = getDateRangeStart(dateRange)

      const [
        subscribersResult,
        transactionsResult,
        allTransactions,
        currentMonthTransactions,
        lastMonthTransactions,
        plansResult,
        allSubscribersForMRR,
        allTimeTransactions,
      ] = await Promise.all([
        supabase
          .from('subscribers')
          .select('*, subscription_plans(name, price, billing_cycle)')
          .eq('merchant_id', user!.id),

        supabase
          .from('payment_transactions')
          .select('*, subscribers(customer_name), subscription_plans(name)')
          .eq('merchant_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase
          .from('payment_transactions')
          .select('amount, payment_date, status')
          .eq('merchant_id', user!.id)
          .eq('status', 'success')
          .gte('payment_date', rangeDate.toISOString()),

        supabase
          .from('payment_transactions')
          .select('amount, status')
          .eq('merchant_id', user!.id)
          .eq('status', 'success')
          .gte('payment_date', getFirstDayOfMonth(0)),

        supabase
          .from('payment_transactions')
          .select('amount, status')
          .eq('merchant_id', user!.id)
          .eq('status', 'success')
          .gte('payment_date', getFirstDayOfMonth(-1))
          .lt('payment_date', getFirstDayOfMonth(0)),

        supabase
          .from('subscription_plans')
          .select('*')
          .eq('merchant_id', user!.id),

        supabase
          .from('subscribers')
          .select('*, subscription_plans(price, billing_cycle)')
          .eq('merchant_id', user!.id),

        supabase
          .from('payment_transactions')
          .select('amount, status')
          .eq('merchant_id', user!.id)
          .eq('status', 'success'),
      ])

      if (subscribersResult.data) {
        const allSubscribers = subscribersResult.data
        const activeSubscribers = allSubscribers.filter((s) => s.status === 'active')
        const cancelledSubscribers = allSubscribers.filter((s) => s.status === 'cancelled')

        const activeCount = activeSubscribers.length

        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const upcomingRenewals = activeSubscribers.filter(
          (s) => s.next_renewal_date && new Date(s.next_renewal_date) <= nextWeek
        ).length

        const currentMonthStart = getFirstDayOfMonth(0)
        const lastMonthStart = getFirstDayOfMonth(-1)

        const subscribersThisMonth = allSubscribers.filter(
          (s) => new Date(s.start_date) >= new Date(currentMonthStart)
        ).length

        const subscribersLastMonth = allSubscribers.filter(
          (s) =>
            new Date(s.start_date) >= new Date(lastMonthStart) &&
            new Date(s.start_date) < new Date(currentMonthStart)
        ).length

        const subscriberGrowth =
          subscribersLastMonth > 0
            ? ((subscribersThisMonth - subscribersLastMonth) / subscribersLastMonth) * 100
            : subscribersThisMonth > 0
            ? 100
            : 0

        const cancelledThisMonth = cancelledSubscribers.filter(
          (s) => s.updated_at && new Date(s.updated_at) >= new Date(currentMonthStart)
        ).length

        const activeAtMonthStart = activeCount + cancelledThisMonth
        const churnRate = activeAtMonthStart > 0 ? (cancelledThisMonth / activeAtMonthStart) * 100 : 0

        const currentMonthRevenue =
          currentMonthTransactions.data?.reduce((sum, t) => sum + t.amount, 0) || 0

        const lastMonthRevenue =
          lastMonthTransactions.data?.reduce((sum, t) => sum + t.amount, 0) || 0

        const monthlyRevenueGrowth =
          lastMonthRevenue > 0
            ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
            : currentMonthRevenue > 0
            ? 100
            : 0

        const totalRevenue = allTimeTransactions.data?.reduce((sum, t) => sum + t.amount, 0) || 0

        const revenueGrowth = monthlyRevenueGrowth

        const currentActiveSubscribers =
          allSubscribersForMRR.data?.filter((s) => s.status === 'active') || []

        const mrr = currentActiveSubscribers.reduce((sum, sub) => {
          const plan = sub.subscription_plans as any
          if (!plan) return sum

          let monthlyRevenue = 0
          if (plan.billing_cycle === 'monthly') {
            monthlyRevenue = plan.price
          } else if (plan.billing_cycle === 'yearly') {
            monthlyRevenue = plan.price / 12
          } else if (plan.billing_cycle === 'quarterly') {
            monthlyRevenue = plan.price / 3
          }
          return sum + monthlyRevenue
        }, 0)

        const lastMonthActiveSubscribers =
          allSubscribersForMRR.data?.filter((s) => {
            const startDate = new Date(s.start_date)
            const isStartedBeforeThisMonth = startDate < new Date(currentMonthStart)
            const isActiveLastMonth =
              s.status === 'active' ||
              (s.status === 'cancelled' &&
                s.updated_at &&
                new Date(s.updated_at) >= new Date(currentMonthStart))
            return isStartedBeforeThisMonth && isActiveLastMonth
          }) || []

        const lastMonthMRR = lastMonthActiveSubscribers.reduce((sum, sub) => {
          const plan = sub.subscription_plans as any
          if (!plan) return sum

          let monthlyRevenue = 0
          if (plan.billing_cycle === 'monthly') {
            monthlyRevenue = plan.price
          } else if (plan.billing_cycle === 'yearly') {
            monthlyRevenue = plan.price / 12
          } else if (plan.billing_cycle === 'quarterly') {
            monthlyRevenue = plan.price / 3
          }
          return sum + monthlyRevenue
        }, 0)

        const mrrGrowth =
          lastMonthMRR > 0 ? ((mrr - lastMonthMRR) / lastMonthMRR) * 100 : mrr > 0 ? 100 : 0

        const arr = mrr * 12
        const lastMonthARR = lastMonthMRR * 12
        const arrGrowth =
          lastMonthARR > 0 ? ((arr - lastMonthARR) / lastMonthARR) * 100 : arr > 0 ? 100 : 0

        setStats({
          totalRevenue,
          revenueGrowth,
          activeSubscribers: activeCount,
          subscriberGrowth,
          upcomingRenewals,
          churnRate,
          mrr,
          arr,
          mrrGrowth,
          arrGrowth,
          monthlyRevenue: currentMonthRevenue,
          monthlyRevenueGrowth,
        })

        const subscribersByMonth = prepareSubscriberChartData(allSubscribers, dateRange)
        setSubscriberChartData(subscribersByMonth)

        if (plansResult.data) {
          const revenueByPlan = prepareRevenueByPlanData(allSubscribers, plansResult.data)
          setRevenueByPlanData(revenueByPlan)
        }
      }

      if (allTransactions.data) {
        const revenueByMonth = prepareRevenueChartData(allTransactions.data, dateRange)
        setRevenueChartData(revenueByMonth)
      }

      if (transactionsResult.data) {
        const activities = transactionsResult.data.map((t: any) => ({
          id: t.id,
          customer_name: t.subscribers?.customer_name || 'Unknown',
          plan_name: t.subscription_plans?.name || 'Unknown Plan',
          date: new Date(t.payment_date).toISOString().split('T')[0],
          amount: t.amount,
          status: t.status,
        }))
        setRecentActivity(activities)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getDateRangeStart = (range: string): Date => {
    const date = new Date()
    switch (range) {
      case '7d':
        date.setDate(date.getDate() - 7)
        break
      case '30d':
        date.setDate(date.getDate() - 30)
        break
      case '90d':
        date.setDate(date.getDate() - 90)
        break
      case '6m':
        date.setMonth(date.getMonth() - 6)
        break
      case '1y':
        date.setFullYear(date.getFullYear() - 1)
        break
    }
    return date
  }

  const getMonthCount = (range: string): number => {
    switch (range) {
      case '7d':
        return 1
      case '30d':
        return 1
      case '90d':
        return 3
      case '6m':
        return 6
      case '1y':
        return 12
      default:
        return 6
    }
  }

  const prepareRevenueChartData = (transactions: any[], range: string): RevenueChartData[] => {
    const monthlyData: { [key: string]: number } = {}
    const monthCount = getMonthCount(range)

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      monthlyData[monthKey] = 0
    }

    transactions.forEach((transaction) => {
      const date = new Date(transaction.payment_date)
      const monthKey = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      if (monthlyData.hasOwnProperty(monthKey)) {
        monthlyData[monthKey] += transaction.amount
      }
    })

    return Object.entries(monthlyData).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue * 100) / 100,
    }))
  }

  const prepareSubscriberChartData = (subscribers: any[], range: string): SubscriberChartData[] => {
    const monthlyData: { [key: string]: { new: number; churned: number } } = {}
    const monthCount = getMonthCount(range)

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      monthlyData[monthKey] = { new: 0, churned: 0 }
    }

    subscribers.forEach((sub) => {
      const startDate = new Date(sub.start_date)
      const startMonthKey = startDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      if (monthlyData.hasOwnProperty(startMonthKey)) {
        monthlyData[startMonthKey].new += 1
      }

      if (sub.status === 'cancelled' && sub.updated_at) {
        const cancelDate = new Date(sub.updated_at)
        const cancelMonthKey = cancelDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
        if (monthlyData.hasOwnProperty(cancelMonthKey)) {
          monthlyData[cancelMonthKey].churned += 1
        }
      }
    })

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      newSubscribers: data.new,
      churned: data.churned,
    }))
  }

  const prepareRevenueByPlanData = (subscribers: any[], plans: any[]): RevenueByPlanData[] => {
    const planRevenue: {
      [key: string]: { revenue: number; subscribers: number; planName: string; planPrice: number }
    } = {}

    plans.forEach((plan) => {
      planRevenue[plan.id] = {
        revenue: 0,
        subscribers: 0,
        planName: plan.name,
        planPrice: plan.price,
      }
    })

    subscribers.forEach((sub) => {
      const plan = sub.subscription_plans as any

      if (planRevenue[sub.plan_id]) {
        const revenue = sub.last_payment_amount || plan?.price || 0
        planRevenue[sub.plan_id].revenue += revenue
        planRevenue[sub.plan_id].subscribers += 1
      } else if (plan) {
        planRevenue[sub.plan_id] = {
          revenue: sub.last_payment_amount || plan.price || 0,
          subscribers: 1,
          planName: plan.name || 'Deleted Plan',
          planPrice: plan.price || 0,
        }
      }
    })

    return Object.values(planRevenue)
      .filter((p) => p.subscribers > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map(({ planPrice, ...rest }) => rest)
  }

  const getFirstDayOfMonth = (monthOffset: number): string => {
    const date = new Date()
    date.setMonth(date.getMonth() + monthOffset)
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
  }

  const exportToCSV = () => {
    const csvData = [
      ['Metric', 'Value'],
      ['Monthly Revenue', `₹${stats.monthlyRevenue.toFixed(2)}`],
      ['Total Revenue', `₹${stats.totalRevenue.toFixed(2)}`],
      ['MRR', `₹${stats.mrr.toFixed(2)}`],
      ['ARR', `₹${stats.arr.toFixed(2)}`],
      ['Active Subscribers', stats.activeSubscribers.toString()],
      ['Churn Rate', `${stats.churnRate.toFixed(1)}%`],
      ['Upcoming Renewals', stats.upcomingRenewals.toString()],
      [],
      ['Recent Transactions'],
      ['Customer', 'Plan', 'Amount', 'Date', 'Status'],
      ...recentActivity.map((a) => [
        a.customer_name,
        a.plan_name,
        `₹${a.amount}`,
        a.date,
        a.status,
      ]),
    ]

    const csv = csvData.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getGrowthIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />
    if (value < 0) return <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-500'
    if (value < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  const CustomTooltip = ({ active, payload, label, type }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          {type === 'revenue' ? (
            <p className="text-blue-600">Revenue: ₹{payload[0].value.toFixed(2)}</p>
          ) : type === 'subscribers' ? (
            <>
              <p className="text-green-600">New: {payload[0].value}</p>
              {payload[1] && <p className="text-red-600">Churned: {payload[1].value}</p>}
              <p className="text-gray-600 font-semibold mt-1">
                Net: {payload[0].value - (payload[1]?.value || 0)}
              </p>
            </>
          ) : null}
        </div>
      )
    }
    return null
  }

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180)
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180)

    return percent > 0.05 ? (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-semibold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    
    <div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateRange('7d')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              dateRange === '7d' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setDateRange('30d')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              dateRange === '30d' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setDateRange('90d')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              dateRange === '90d' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            90 Days
          </button>
          <button
            onClick={() => setDateRange('6m')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              dateRange === '6m' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            6 Months
          </button>
          <button
            onClick={() => setDateRange('1y')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              dateRange === '1y' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            1 Year
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-white text-gray-700 border rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Row 1: Monthly Revenue | Total Revenue | Active Subscribers | Avg Revenue per User */}
<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6'>
  {/* Monthly Revenue */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Monthly Revenue</p>
      <p className='text-2xl font-bold text-gray-800'>
        ₹{stats.monthlyRevenue.toFixed(2)}
      </p>
      <div className={`text-xs flex items-center gap-1 mt-1 ${getGrowthColor(stats.monthlyRevenueGrowth)}`}>
        {getGrowthIcon(stats.monthlyRevenueGrowth)}
        <span>
          {stats.monthlyRevenueGrowth > 0 ? '+' : ''}
          {stats.monthlyRevenueGrowth.toFixed(1)}% from last month
        </span>
      </div>
    </div>
    <div className='bg-blue-100 text-blue-500 rounded-full p-3'>
      <Wallet className='w-6 h-6' />
    </div>
  </div>

  {/* Total Revenue */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Total Revenue</p>
      <p className='text-2xl font-bold text-gray-800'>
        ₹{stats.totalRevenue.toFixed(2)}
      </p>
      <div className={`text-xs flex items-center gap-1 mt-1 ${getGrowthColor(stats.revenueGrowth)}`}>
        {getGrowthIcon(stats.revenueGrowth)}
        <span>
          {stats.revenueGrowth > 0 ? '+' : ''}
          {stats.revenueGrowth.toFixed(1)}% from last month
        </span>
      </div>
    </div>
    <div className='bg-green-100 text-green-500 rounded-full p-3'>
      <CreditCard className='w-6 h-6' />
    </div>
  </div>

  {/* Active Subscribers */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Active Subscribers</p>
      <p className='text-2xl font-bold text-gray-800'>
        {stats.activeSubscribers}
      </p>
      <div className={`text-xs flex items-center gap-1 mt-1 ${getGrowthColor(stats.subscriberGrowth)}`}>
        {getGrowthIcon(stats.subscriberGrowth)}
        <span>
          {stats.subscriberGrowth > 0 ? '+' : ''}
          {stats.subscriberGrowth.toFixed(1)}% this month
        </span>
      </div>
    </div>
    <div className='bg-purple-100 text-purple-500 rounded-full p-3'>
      <Users className='w-6 h-6' />
    </div>
  </div>

  {/* Avg Revenue per User */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Avg Revenue per User</p>
      <p className='text-2xl font-bold text-gray-800'>
        ₹{stats.activeSubscribers > 0 ? (stats.monthlyRevenue / stats.activeSubscribers).toFixed(2) : '0.00'}
      </p>
      <p className='text-xs text-gray-500 mt-1'>ARPU (Monthly)</p>
    </div>
    <div className='bg-orange-100 text-orange-500 rounded-full p-3'>
      <UserCheck className='w-6 h-6' />
    </div>
  </div>
</div>

{/* Row 2: MRR | ARR | Upcoming Renewals | Churn Rate */}
<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6'>
  {/* MRR (Monthly Recurring Revenue) */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>MRR (Monthly Recurring)</p>
      <p className='text-2xl font-bold text-gray-800'>
        ₹{stats.mrr.toFixed(2)}
      </p>
      <div className={`text-xs flex items-center gap-1 mt-1 ${getGrowthColor(stats.mrrGrowth)}`}>
        {getGrowthIcon(stats.mrrGrowth)}
        <span>
          {stats.mrrGrowth > 0 ? '+' : ''}
          {stats.mrrGrowth.toFixed(1)}% from last month
        </span>
      </div>
    </div>
    <div className='bg-indigo-100 text-indigo-500 rounded-full p-3'>
      <Activity className='w-6 h-6' />
    </div>
  </div>

  {/* ARR (Annual Recurring Revenue) */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>ARR (Annual Recurring)</p>
      <p className='text-2xl font-bold text-gray-800'>
        ₹{stats.arr.toFixed(2)}
      </p>
      <div className={`text-xs flex items-center gap-1 mt-1 ${getGrowthColor(stats.arrGrowth)}`}>
        {getGrowthIcon(stats.arrGrowth)}
        <span>
          {stats.arrGrowth > 0 ? '+' : ''}
          {stats.arrGrowth.toFixed(1)}% from last month
        </span>
      </div>
    </div>
    <div className='bg-pink-100 text-pink-500 rounded-full p-3'>
      <TrendingUp className='w-6 h-6' />
    </div>
  </div>

  {/* Upcoming Renewals */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Upcoming Renewals</p>
      <p className='text-2xl font-bold text-gray-800'>
        {stats.upcomingRenewals}
      </p>
      <p className='text-xs text-gray-500 mt-1'>Due in next 7 days</p>
    </div>
    <div className='bg-cyan-100 text-cyan-500 rounded-full p-3'>
      <Calendar className='w-6 h-6' />
    </div>
  </div>

  {/* Churn Rate */}
  <div className='bg-white p-6 rounded-xl shadow-sm flex items-center justify-between'>
    <div>
      <p className='text-sm font-medium text-gray-500'>Churn Rate</p>
      <p className='text-2xl font-bold text-gray-800'>
        {stats.churnRate.toFixed(1)}%
      </p>
      <p className={`text-xs flex items-center mt-1 ${stats.churnRate < 5 ? 'text-green-500' : 'text-red-500'}`}>
        {stats.churnRate < 5 ? 'Healthy' : 'Needs attention'}
      </p>
    </div>
    <div className='bg-red-100 text-red-500 rounded-full p-3'>
      <TrendingDown className='w-6 h-6' />
    </div>
  </div>
</div>

 {/* Charts Row */}
<div className='mt-6'></div>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">New vs Churned Subscribers</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {dateRange === '7d'
            ? '7 days'
            : dateRange === '30d'
            ? '30 days'
            : dateRange === '90d'
            ? '90 days'
            : dateRange === '6m'
            ? '6 months'
            : '1 year'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={subscriberChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" stroke="#6B7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
          <Tooltip content={(props) => <CustomTooltip {...props} type="subscribers" />} />
          <Legend />
          <Bar dataKey="newSubscribers" fill="#10B981" name="New" radius={[4, 4, 0, 0]} />
          <Bar dataKey="churned" fill="#EF4444" name="Churned" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">Revenue Trend</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {dateRange === '7d'
            ? '7 days'
            : dateRange === '30d'
            ? '30 days'
            : dateRange === '90d'
            ? '90 days'
            : dateRange === '6m'
            ? '6 months'
            : '1 year'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={revenueChartData}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" stroke="#6B7280" style={{ fontSize: '12px' }} />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `₹${value}`}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} type="revenue" />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3B82F6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>

  {/* Revenue by Plan & Recent Activity */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="font-semibold text-gray-700 mb-4">Revenue by Plan</h3>
      {revenueByPlanData.length > 0 ? (
        <>
         <ResponsiveContainer width="100%" height={280}>
  <PieChart>
    <Pie
      data={revenueByPlanData}
      cx="50%"
      cy="50%"
      labelLine={false}
      label={CustomPieLabel}
      outerRadius={100}
      fill="#8884d8"
      dataKey="revenue"
    >
      {revenueByPlanData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip 
      formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Revenue']}
    />  {/* ✅ NEW */}
  </PieChart>
</ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {revenueByPlanData.map((plan, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-gray-700">{plan.planName}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">₹{plan.revenue.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{plan.subscribers} subscribers</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[350px] flex items-center justify-center text-gray-400">
          <p>No plan data available</p>
        </div>
      )}
    </div>

    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="font-semibold text-gray-700 mb-4">Recent Activity</h3>
      <div className="overflow-y-auto max-h-[350px]">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th scope="col" className="px-4 py-3">
                Customer
              </th>
              <th scope="col" className="px-4 py-3">
                Plan
              </th>
              <th scope="col" className="px-4 py-3">
                Amount
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No recent activity
                </td>
              </tr>
            ) : (
              recentActivity.map((activity) => (
                <tr key={activity.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {activity.customer_name}
                  </td>
                  <td className="px-4 py-3">{activity.plan_name}</td>
                  <td className="px-4 py-3">₹{activity.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center ${getStatusColor(activity.status)}`}>
                      <div
                        className={`h-2 w-2 rounded-full mr-2 ${
                          activity.status === 'success'
                            ? 'bg-green-500'
                            : activity.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                        }`}
                      ></div>
                      {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
)
}