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

  const loadMerchantProfile = async (userId: string): Promise<void> => {
    try {
      const profile = await getMerchantProfile(userId)
      setMerchant(profile)
    } catch (err) {
      console.error('Error loading merchant profile:', err)
      setMerchant(null)
    }
  }

  const refreshMerchant = async (): Promise<void> => {
    if (user) {
      await loadMerchantProfile(user.id)
    }
  }

  useEffect(() => {
    // getUser() verifies the token with Supabase's server.
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser ?? null)
      if (currentUser) {
        loadMerchantProfile(currentUser.id)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // onAuthStateChange provides a session object — we extract the user
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (sessionUser) {
        loadMerchantProfile(sessionUser.id)
      } else {
        setMerchant(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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