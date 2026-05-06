'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

interface Notification {
  id: string
  type: 'new_subscriber' | 'cancellation' | 'failed_payment' | 'upcoming_renewal'
  message: string
  timestamp: string
  read: boolean
  customer_name?: string
  plan_name?: string
  amount?: number
}

interface PlanJoin {
  name?: string | null
}

interface SubscriberRow {
  id: string
  customer_name: string
  status: string
  created_at: string
  updated_at: string
  subscription_plans?: PlanJoin | null
}

interface FailedPaymentRow {
  id: string
  payment_date: string
  amount: number
  subscribers?: {
    customer_name?: string | null
  } | null
  subscription_plans?: PlanJoin | null
}

interface UpcomingRenewalRow {
  id: string
  customer_name: string
  next_renewal_date: string
  subscription_plans?: PlanJoin | null
}

// Per-merchant notification state persisted in localStorage.
// dismissedIds   - IDs permanently hidden by the user.
// lastReadAt     - ISO timestamp; notifications newer than this are "unread" (badge shown).
//                  Updated to now() each time the bell is opened.
// clearedAt      - ISO timestamp; notifications older than this are hidden (set by "Clear all").
interface NotifPersistedState {
  dismissedIds: string[]
  lastReadAt: string
  clearedAt: string | null
}

function storageKey(userId: string): string {
  return `substrack_notif_${userId}`
}

function loadPersistedState(userId: string): NotifPersistedState {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw) return JSON.parse(raw) as NotifPersistedState
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) - degrade gracefully
  }
  return { dismissedIds: [], lastReadAt: new Date(0).toISOString(), clearedAt: null }
}

function savePersistedState(userId: string, state: NotifPersistedState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // Fail silently - notifications still work in-session, just won't persist
  }
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [persisted, setPersisted] = useState<NotifPersistedState>({
    dismissedIds: [],
    lastReadAt: new Date(0).toISOString(),
    clearedAt: null,
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Unread = notifications generated after the last time the bell was opened.
  const unreadCount = notifications.filter(
    (n) => new Date(n.timestamp) > new Date(persisted.lastReadAt)
  ).length

  // Hydrate persisted state from localStorage once per user session.
  useEffect(() => {
    if (!user) return
    const stored = loadPersistedState(user.id)
    setPersisted(stored)
  }, [user])

  // Load notifications and subscribe to realtime updates.
  // Intentionally does NOT list persisted/dismissedIds as a dependency -
  // loadNotifications reads localStorage directly so realtime callbacks
  // always use the latest dismissed/cleared values without stale closures.
  useEffect(() => {
    if (!user) return
    void loadNotifications()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscribers',
          filter: `merchant_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reads localStorage directly (not React state) so this function is safe to call
  // from realtime callbacks where the persisted closure would be stale.
  const loadNotifications = async (): Promise<void> => {
    if (!user) return
    try {
      const stored = loadPersistedState(user.id)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: subscribers, error: subError } = await supabase
        .from('subscribers')
        .select(`
          id,
          customer_name,
          status,
          created_at,
          updated_at,
          subscription_plans!plan_id (name)
        `)
        .eq('merchant_id', user.id)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20)

      if (subError) throw subError

      const { data: failedPayments, error: payError } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          payment_date,
          amount,
          subscribers (customer_name),
          subscription_plans!plan_id (name)
        `)
        .eq('merchant_id', user.id)
        .eq('status', 'failed')
        .gte('payment_date', sevenDaysAgo.toISOString())
        .order('payment_date', { ascending: false })
        .limit(10)

      if (payError) throw payError

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const { data: upcomingRenewals, error: renewError } = await supabase
        .from('subscribers')
        .select(`
          id,
          customer_name,
          next_renewal_date,
          subscription_plans!plan_id (name)
        `)
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('next_renewal_date', new Date().toISOString())
        .lte('next_renewal_date', nextWeek.toISOString())
        .order('next_renewal_date', { ascending: true })
        .limit(10)

      if (renewError) throw renewError

      const allNotifications: Notification[] = []

      subscribers?.forEach((sub: SubscriberRow) => {
        const isNew = new Date(sub.created_at).getTime() >= sevenDaysAgo.getTime()
        const planName = sub.subscription_plans?.name || 'Unknown Plan'

        if (isNew && sub.status === 'active') {
          allNotifications.push({
            id: `new-${sub.id}`,
            type: 'new_subscriber',
            message: `${sub.customer_name} subscribed to ${planName}`,
            timestamp: sub.created_at,
            read: false,
            customer_name: sub.customer_name,
            plan_name: planName,
          })
        } else if (sub.status === 'cancelled') {
          allNotifications.push({
            id: `cancel-${sub.id}`,
            type: 'cancellation',
            message: `${sub.customer_name} cancelled their ${planName} subscription`,
            timestamp: sub.updated_at,
            read: false,
            customer_name: sub.customer_name,
            plan_name: planName,
          })
        }
      })

      failedPayments?.forEach((payment: FailedPaymentRow) => {
        const customerName = payment.subscribers?.customer_name || 'Unknown Customer'
        const planName = payment.subscription_plans?.name || 'Unknown Plan'
        allNotifications.push({
          id: `failed-${payment.id}`,
          type: 'failed_payment',
          message: `Payment of ₹${payment.amount.toFixed(2)} failed for ${customerName}`,
          timestamp: payment.payment_date,
          read: false,
          customer_name: customerName,
          plan_name: planName,
          amount: payment.amount,
        })
      })

      upcomingRenewals?.forEach((renewal: UpcomingRenewalRow) => {
        const planName = renewal.subscription_plans?.name || 'Unknown Plan'
        const daysUntil = Math.ceil(
          (new Date(renewal.next_renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        allNotifications.push({
          id: `renewal-${renewal.id}`,
          type: 'upcoming_renewal',
          message: `${renewal.customer_name}'s ${planName} renews in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          timestamp: renewal.next_renewal_date,
          read: false,
          customer_name: renewal.customer_name,
          plan_name: planName,
        })
      })

      allNotifications.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      const dismissedSet = new Set(stored.dismissedIds)
      const clearedAt = stored.clearedAt ? new Date(stored.clearedAt) : null

      const visible = allNotifications
        .filter((n) => !dismissedSet.has(n.id))
        .filter((n) => !clearedAt || new Date(n.timestamp) > clearedAt)
        .slice(0, 20)

      setNotifications(visible)
    } catch {
      // Notifications are non-critical - fail silently
    }
  }

  const handleBellClick = (): void => {
    const opening = !isOpen
    setIsOpen(opening)
    // Mark all visible notifications as read when bell opens
    if (opening && user) {
      const newState: NotifPersistedState = {
        ...persisted,
        lastReadAt: new Date().toISOString(),
      }
      setPersisted(newState)
      savePersistedState(user.id, newState)
    }
  }

  const dismissNotification = (id: string): void => {
    const newState: NotifPersistedState = {
      ...persisted,
      dismissedIds: [...persisted.dismissedIds, id],
    }
    setPersisted(newState)
    if (user) savePersistedState(user.id, newState)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const clearAll = (): void => {
    const newState: NotifPersistedState = {
      dismissedIds: [],
      lastReadAt: new Date().toISOString(),
      clearedAt: new Date().toISOString(),
    }
    setPersisted(newState)
    if (user) savePersistedState(user.id, newState)
    setNotifications([])
    setIsOpen(false)
  }

  const getNotificationIcon = (type: Notification['type']): string => {
    switch (type) {
      case 'new_subscriber':
        return '🎉'
      case 'cancellation':
        return '❌'
      case 'failed_payment':
        return '⚠️'
      case 'upcoming_renewal':
        return '📅'
      default:
        return '🔔'
    }
  }

  const getNotificationColor = (type: Notification['type']): string => {
    switch (type) {
      case 'new_subscriber':
        return 'border-green-400'
      case 'cancellation':
        return 'border-gray-300'
      case 'failed_payment':
        return 'border-red-400'
      case 'upcoming_renewal':
        return 'border-blue-400'
      default:
        return 'border-gray-300'
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label="Open notifications"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
              {notifications.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{notifications.length} recent</p>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No new notifications</p>
                <p className="text-gray-400 text-xs mt-1">You&apos;re all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const isUnread =
                    new Date(notification.timestamp) > new Date(persisted.lastReadAt)
                  return (
                    <li
                      key={notification.id}
                      className={`p-4 transition-colors cursor-pointer border-l-4 ${getNotificationColor(notification.type)} ${isUnread ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-xl shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}
                          >
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          {isUnread && (
                            <span
                              className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                              aria-label="Unread"
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              dismissNotification(notification.id)
                            }}
                            className="text-gray-300 hover:text-gray-500 transition-colors rounded p-0.5"
                            aria-label="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
