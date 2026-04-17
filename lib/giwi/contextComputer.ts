// lib/giwi/contextComputer.ts
//
// Computes the merchant context document from live database data.
// Called by app/api/ai/context/route.ts.
// Uses serviceSupabase (bypasses RLS) — always scope by merchant_id.
// Returns MerchantContextDocument — zero PII, only aggregated signals.

import { serviceSupabase } from '@/lib/supabase/service'
import type { MerchantContextDocument, PlanBadge, PlanBadgeState } from '@/lib/types'

interface ContextPlanRow {
  id: string
  name: string
  price: number
  billing_cycle: string
  is_active: boolean
  trial_period_days: number | null
  archived_at: string | null
}

interface ContextSubscriberPlan {
  id?: string
  name?: string
  price: number
  billing_cycle: string
  trial_period_days?: number | null
}

interface ActiveSubscriberRow {
  id: string
  plan_id: string
  start_date: string
  status: string
  subscription_plans: ContextSubscriberPlan | ContextSubscriberPlan[] | null
}

interface CancelledSubscriberRow {
  id: string
  plan_id: string
  cancelled_at: string | null
}

interface NewSubscriberRow {
  id: string
  plan_id: string
}

interface LastMonthActiveRow {
  id: string
  plan_id: string
  subscription_plans: ContextSubscriberPlan | ContextSubscriberPlan[] | null
}

interface UpcomingRenewalRow {
  id: string
  next_renewal_date: string | null
}

interface PaymentStatusRow {
  id: string
  status: string
}

interface PastDueSubscriberRow {
  id: string
  last_payment_amount: number | null
}

function getSinglePlan(
  plan: ContextSubscriberPlan | ContextSubscriberPlan[] | null
): ContextSubscriberPlan | null {
  if (!plan) return null
  return Array.isArray(plan) ? plan[0] ?? null : plan
}

export async function computeMerchantContext(
  merchantId: string
): Promise<MerchantContextDocument> {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activeSubscribers } = await serviceSupabase
    .from('subscribers')
    .select('id, plan_id, start_date, status, subscription_plans(id, name, price, billing_cycle, trial_period_days)')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')

  const { data: cancelledThisMonth } = await serviceSupabase
    .from('subscribers')
    .select('id, plan_id, cancelled_at')
    .eq('merchant_id', merchantId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', currentMonthStart)

  const { data: newThisMonth } = await serviceSupabase
    .from('subscribers')
    .select('id, plan_id')
    .eq('merchant_id', merchantId)
    .gte('start_date', currentMonthStart)
    .neq('status', 'cancelled')

  const { data: lastMonthActive } = await serviceSupabase
    .from('subscribers')
    .select('id, plan_id, subscription_plans(price, billing_cycle)')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .lt('start_date', currentMonthStart)
    .gte('start_date', lastMonthStart)

  const { data: upcomingRenewals } = await serviceSupabase
    .from('subscribers')
    .select('id, next_renewal_date')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .lte('next_renewal_date', sevenDaysFromNow)
    .gte('next_renewal_date', now.toISOString())

  const { data: pastDueSubscribers } = await serviceSupabase
    .from('subscribers')
    .select('id, last_payment_amount')
    .eq('merchant_id', merchantId)
    .eq('status', 'past_due')

  const { data: failedPayments } = await serviceSupabase
    .from('payment_transactions')
    .select('id, status')
    .eq('merchant_id', merchantId)
    .eq('status', 'failed')
    .gte('payment_date', currentMonthStart)

  const { data: totalPayments } = await serviceSupabase
    .from('payment_transactions')
    .select('id, status')
    .eq('merchant_id', merchantId)
    .gte('payment_date', currentMonthStart)

  const { data: plans } = await serviceSupabase
    .from('subscription_plans')
    .select('id, name, price, billing_cycle, is_active, trial_period_days, archived_at')
    .eq('merchant_id', merchantId)

  const activeSubscriberRows = (activeSubscribers ?? []) as ActiveSubscriberRow[]
  const cancelledThisMonthRows = (cancelledThisMonth ?? []) as CancelledSubscriberRow[]
  const newThisMonthRows = (newThisMonth ?? []) as NewSubscriberRow[]
  const lastMonthActiveRows = (lastMonthActive ?? []) as LastMonthActiveRow[]
  const upcomingRenewalRows = (upcomingRenewals ?? []) as UpcomingRenewalRow[]
  const pastDueRows = (pastDueSubscribers ?? []) as PastDueSubscriberRow[]
  const failedPaymentRows = (failedPayments ?? []) as PaymentStatusRow[]
  const totalPaymentRows = (totalPayments ?? []) as PaymentStatusRow[]
  const planRows = (plans ?? []) as ContextPlanRow[]

  const calculateMonthlyRevenue = (price: number, billingCycle: string): number => {
    switch (billingCycle) {
      case 'monthly':
        return price
      case 'yearly':
        return price / 12
      case 'quarterly':
        return price / 3
      case 'weekly':
        return price * 4.33
      case 'daily':
        return price * 30
      default:
        return price
    }
  }

  const currentMrr = activeSubscriberRows.reduce((sum, sub) => {
    const plan = getSinglePlan(sub.subscription_plans)
    if (!plan) return sum
    return sum + calculateMonthlyRevenue(plan.price, plan.billing_cycle)
  }, 0)

  const lastMonthMrr = lastMonthActiveRows.reduce((sum, sub) => {
    const plan = getSinglePlan(sub.subscription_plans)
    if (!plan) return sum
    return sum + calculateMonthlyRevenue(plan.price, plan.billing_cycle)
  }, 0)

  const mrrGrowthPercent = lastMonthMrr > 0
    ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100
    : currentMrr > 0 ? 100 : 0

  const activeCount = activeSubscriberRows.length
  const arpu = activeCount > 0 ? currentMrr / activeCount : 0

  const cancelledCount = cancelledThisMonthRows.length
  const activeAtMonthStart = activeCount + cancelledCount
  const churnRatePercent = activeAtMonthStart > 0
    ? (cancelledCount / activeAtMonthStart) * 100
    : 0

  const avgTenureDays = activeCount > 0
    ? activeSubscriberRows.reduce((sum, sub) => {
        const start = new Date(sub.start_date)
        const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        return sum + diffDays
      }, 0) / activeCount
    : 0

  const planMap: Record<string, {
    plan_id: string
    plan_name: string
    price: number
    billing_cycle: string
    trial_period_days: number
    active_subscribers: number
    new_this_month: number
    cancelled_this_month: number
  }> = {}

  planRows.forEach((plan) => {
    if (!plan.archived_at) {
      planMap[plan.id] = {
        plan_id: plan.id,
        plan_name: plan.name,
        price: plan.price,
        billing_cycle: plan.billing_cycle,
        trial_period_days: plan.trial_period_days ?? 0,
        active_subscribers: 0,
        new_this_month: 0,
        cancelled_this_month: 0,
      }
    }
  })

  activeSubscriberRows.forEach((sub) => {
    if (planMap[sub.plan_id]) planMap[sub.plan_id].active_subscribers++
  })

  newThisMonthRows.forEach((sub) => {
    if (planMap[sub.plan_id]) planMap[sub.plan_id].new_this_month++
  })

  cancelledThisMonthRows.forEach((sub) => {
    if (planMap[sub.plan_id]) planMap[sub.plan_id].cancelled_this_month++
  })

  const planArray = Object.values(planMap).map((plan) => ({
    ...plan,
    revenue_contribution_percent: currentMrr > 0
      ? (calculateMonthlyRevenue(plan.price, plan.billing_cycle) * plan.active_subscribers / currentMrr) * 100
      : 0,
  }))

  const sortedByRevenue = [...planArray].sort(
    (a, b) => (calculateMonthlyRevenue(b.price, b.billing_cycle) * b.active_subscribers)
      - (calculateMonthlyRevenue(a.price, a.billing_cycle) * a.active_subscribers)
  )
  const top3Revenue = sortedByRevenue.slice(0, 3).reduce(
    (sum, p) => sum + (calculateMonthlyRevenue(p.price, p.billing_cycle) * p.active_subscribers),
    0
  )
  const top3Percent = currentMrr > 0 ? (top3Revenue / currentMrr) * 100 : 0
  const earlyChurnDominant = activeCount > 0
    ? activeSubscriberRows.filter((sub) => {
        const daysSinceStart = Math.floor(
          (now.getTime() - new Date(sub.start_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSinceStart < 30
      }).length / activeCount > 0.3
    : false

  const pastDueCount = pastDueRows.length
  const revenueAtRisk = pastDueRows.reduce(
    (sum, sub) => sum + (sub.last_payment_amount ?? 0),
    0
  )
  const failedCount = failedPaymentRows.length
  const totalCount = totalPaymentRows.length

  return {
    computed_at: now.toISOString(),
    business_summary: {
      total_active_subscribers: activeCount,
      total_plans: planRows.length,
      active_plans: planRows.filter((plan) => plan.is_active && !plan.archived_at).length,
    },
    revenue: {
      mrr: Math.round(currentMrr * 100) / 100,
      arr: Math.round(currentMrr * 12 * 100) / 100,
      mrr_last_month: Math.round(lastMonthMrr * 100) / 100,
      mrr_growth_percent: Math.round(mrrGrowthPercent * 10) / 10,
      arpu: Math.round(arpu * 100) / 100,
    },
    subscribers: {
      active: activeCount,
      past_due: pastDueCount,
      revenue_at_risk: revenueAtRisk,
      new_this_month: newThisMonthRows.length,
      cancelled_this_month: cancelledCount,
      net_change_this_month: newThisMonthRows.length - cancelledCount,
      churn_rate_percent: Math.round(churnRatePercent * 10) / 10,
      upcoming_renewals_7d: upcomingRenewalRows.length,
      avg_tenure_days: Math.round(avgTenureDays),
    },
    payments: {
      failed_this_month: failedCount,
      total_this_month: totalCount,
      failed_payment_rate_percent: totalCount > 0
        ? Math.round((failedCount / totalCount) * 1000) / 10
        : 0,
    },
    plans: planArray,
    risk_signals: {
      high_concentration_risk: top3Percent > 70,
      top_3_revenue_percent: Math.round(top3Percent),
      early_churn_dominant: earlyChurnDominant,
    },
  }
}

export function computePlanBadges(
  plans: MerchantContextDocument['plans']
): Record<string, PlanBadge> {
  const badges: Record<string, PlanBadge> = {}

  plans.forEach((plan) => {
    let state: PlanBadgeState
    let tooltip: string

    const isNew = plan.active_subscribers === 0 && plan.new_this_month === 0
      && plan.cancelled_this_month === 0

    if (isNew) {
      state = 'new'
      tooltip = 'Not enough data yet — check back after your first subscriber joins this plan.'
    } else if (plan.cancelled_this_month > plan.new_this_month && plan.cancelled_this_month >= 2) {
      state = 'high_churn'
      tooltip = `${plan.cancelled_this_month} subscribers left this month, more than the ${plan.new_this_month} who joined. Review plan value or pricing.`
    } else if (plan.new_this_month > plan.cancelled_this_month && plan.active_subscribers > 0) {
      state = 'growing'
      tooltip = `${plan.new_this_month} new subscribers this month with ${plan.cancelled_this_month} leaving. Healthy growth signal.`
    } else if (plan.active_subscribers === 0) {
      state = 'needs_attention'
      tooltip = 'No active subscribers. Consider promoting this plan or reviewing its pricing.'
    } else {
      state = 'stable'
      tooltip = `${plan.active_subscribers} active subscribers. Movement is balanced this month.`
    }

    badges[plan.plan_id] = { state, tooltip }
  })

  return badges
}
