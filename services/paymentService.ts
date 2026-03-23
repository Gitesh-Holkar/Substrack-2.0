
// Replaces stripeService.ts. Works for both Stripe and Cashfree.
// Calls manage-plan edge function which routes to the correct provider internally.
//
// stripeService.ts is kept in the repo for now — it still works for any
// legacy code that hasn't been updated yet. Migrate callers to this file.

import { createClient } from '@/lib/supabase/client'

export class PaymentService {
  private supabase = createClient()

  async syncPlan(
    planId: string,
    planName: string,
    planDescription: string,
    price: number,
    currency: string,
    billingCycle: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('manage-plan', {
      body: {
        action: 'create',
        planId,
        planName,
        planDescription,
        price,
        currency,
        billingCycle,
      },
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to sync plan with payment gateway')
  }

  async updatePlan(
    planId: string,
    planName: string,
    planDescription: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('manage-plan', {
      body: {
        action: 'update',
        planId,
        planName,
        planDescription,
      },
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to update plan in payment gateway')
  }

  async archivePlan(planId: string): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('manage-plan', {
      body: {
        action: 'archive',
        planId,
      },
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to archive plan in payment gateway')
  }
}