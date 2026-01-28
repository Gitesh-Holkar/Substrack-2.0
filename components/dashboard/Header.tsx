'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { NotificationBell } from './NotificationBell'

export function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { merchant, user } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="flex justify-between items-center p-4 md:p-6 bg-white border-b border-gray-200">
      <div className="flex items-center">
        <button className="md:hidden text-gray-500 focus:outline-none">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-gray-800 ml-4 md:ml-0">Dashboard</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Notification Bell */}
        <NotificationBell />
        
        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {merchant?.logo_url ? (
                <img 
                  src={merchant.logo_url} 
                  alt={merchant.business_name || 'Business logo'} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-gray-600 font-semibold">
                  {merchant && getInitials(merchant.full_name)}
                </span>
              )}
            </div>
            <div className="hidden md:block text-right">
              <div className="font-semibold text-sm text-gray-700">{merchant?.full_name}</div>
              <div className="text-xs text-gray-500">{merchant?.business_name}</div>
            </div>
          </button>
          
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl z-20">
              <button
                onClick={() => {
                  router.push('/dashboard/settings')
                  setDropdownOpen(false)
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Settings
              </button>
              <div className="border-t border-gray-100"></div>
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}