import { createClient } from '@/lib/supabase/client';

export class StripeService {
  // Create checkout session via Supabase Edge Function
  async createSubscriptionCheckout(
    priceId: string,
    customerEmail: string,
    customerName: string,
    planId: string,
    merchantId: string
  ): Promise<string> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId,
          customerEmail,
          customerName,
          planId,
          merchantId,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      return data.url;
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Sync plan to Stripe (create product and price)
  async syncPlanToStripe(
    planId: string,
    planName: string,
    planDescription: string,
    price: number,
    currency: string,
    billingCycle: string
  ): Promise<void> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.functions.invoke('manage-stripe-plan', {
        body: {
          action: 'create',
          planId,
          planName,
          planDescription,
          price,
          currency,
          billingCycle,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create plan in Stripe');
    } catch (error: any) {
      console.error('Error syncing plan to Stripe:', error);
      throw new Error('Failed to sync plan to Stripe');
    }
  }

  // Update plan in Stripe
  async updatePlanInStripe(
    stripeProductId: string,
    planName: string,
    planDescription: string
  ): Promise<void> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.functions.invoke('manage-stripe-plan', {
        body: {
          action: 'update',
          stripeProductId,
          planName,
          planDescription,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update plan in Stripe');
    } catch (error: any) {
      console.error('Error updating plan in Stripe:', error);
      throw new Error('Failed to update plan in Stripe');
    }
  }

  // Archive plan in Stripe
  async archivePlanInStripe(stripeProductId: string): Promise<void> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.functions.invoke('manage-stripe-plan', {
        body: {
          action: 'archive',
          stripeProductId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to archive plan in Stripe');
    } catch (error: any) {
      console.error('Error archiving plan in Stripe:', error);
      throw new Error('Failed to archive plan in Stripe');
    }
  }
}