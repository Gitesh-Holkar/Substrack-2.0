'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
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

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadNotifications()
      
      // Set up real-time subscription for new notifications
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
            loadNotifications()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Get recent subscribers (new, cancelled, failed)
      const { data: subscribers, error: subError } = await supabase
        .from('subscribers')
        .select(`
          id,
          customer_name,
          status,
          created_at,
          updated_at,
          subscription_plans (name)
        `)
        .eq('merchant_id', user!.id)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20)

      if (subError) throw subError

      // Get failed payments
      const { data: failedPayments, error: payError } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          payment_date,
          amount,
          subscribers (customer_name),
          subscription_plans (name)
        `)
        .eq('merchant_id', user!.id)
        .eq('status', 'failed')
        .gte('payment_date', sevenDaysAgo.toISOString())
        .order('payment_date', { ascending: false })
        .limit(10)

      if (payError) throw payError

      // Get upcoming renewals (next 7 days)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const { data: upcomingRenewals, error: renewError } = await supabase
        .from('subscribers')
        .select(`
          id,
          customer_name,
          next_renewal_date,
          subscription_plans (name)
        `)
        .eq('merchant_id', user!.id)
        .eq('status', 'active')
        .gte('next_renewal_date', new Date().toISOString())
        .lte('next_renewal_date', nextWeek.toISOString())
        .order('next_renewal_date', { ascending: true })
        .limit(10)

      if (renewError) throw renewError

      // Build notifications array
      const allNotifications: Notification[] = []

      // New subscribers
      subscribers?.forEach((sub: any) => {
        const isNew = new Date(sub.created_at).getTime() > new Date(sub.updated_at).getTime() - 60000 // Within 1 min
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

      // Failed payments
      failedPayments?.forEach((payment: any) => {
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

      // Upcoming renewals
      upcomingRenewals?.forEach((renewal: any) => {
        const planName = renewal.subscription_plans?.name || 'Unknown Plan'
        const daysUntil = Math.ceil(
          (new Date(renewal.next_renewal_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
        
        allNotifications.push({
          id: `renewal-${renewal.id}`,
          type: 'upcoming_renewal',
          message: `${renewal.customer_name}'s ${planName} renews in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          timestamp: renewal.next_renewal_date!,
          read: false,
          customer_name: renewal.customer_name,
          plan_name: planName,
        })
      })

      // Sort by timestamp
      allNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setNotifications(allNotifications.slice(0, 20))
      setUnreadCount(allNotifications.length)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const getNotificationIcon = (type: Notification['type']) => {
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

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'new_subscriber':
        return 'bg-green-50 border-green-200'
      case 'cancellation':
        return 'bg-gray-50 border-gray-200'
      case 'failed_payment':
        return 'bg-red-50 border-red-200'
      case 'upcoming_renewal':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-gray-500">{unreadCount} new</span>
              )}
            </div>
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
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${getNotificationColor(
                      notification.type
                    )}`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => {
                  setNotifications([])
                  setUnreadCount(0)
                  setIsOpen(false)
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}