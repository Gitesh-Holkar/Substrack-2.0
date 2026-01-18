'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { getMerchantProfile } from '@/lib/auth'
import { Merchant } from '@/lib/types'

interface AuthContextType {
  user: User | null
  merchant: Merchant | null
  loading: boolean
  refreshMerchant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  merchant: null,
  loading: true,
  refreshMerchant: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  const loadMerchantProfile = async (userId: string) => {
    try {
      const profile = await getMerchantProfile(userId)
      setMerchant(profile)
    } catch (error) {
      console.error('Error loading merchant profile:', error)
    }
  }

  const refreshMerchant = async () => {
    if (user) {
      await loadMerchantProfile(user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadMerchantProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadMerchantProfile(session.user.id)
        } else {
          setMerchant(null)
        }
        setLoading(false)
      })()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, merchant, loading, refreshMerchant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}