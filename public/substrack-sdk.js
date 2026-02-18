// public/substrack-sdk.js - EMAIL-BASED VERSION (No JWT tokens)
(function(window) {
  'use strict';

  class Substrack {
    constructor() {
      this.subscriber = null;
      this.initialized = false;
      this.merchantId = null;
      this.apiBase = 'https://niisdiotuzvydotoaurt.supabase.co/functions/v1';
    }

    // Initialize with merchant ID
    async init(merchantId) {
      console.log('🚀 Substrack SDK v3.0.0 (Email-Based) initialized');
      
      if (!merchantId) {
        console.error('❌ Merchant ID is required for initialization');
        return this;
      }

      this.merchantId = merchantId;
      this.initialized = true;
      
      console.log('✅ SDK ready. Call checkSubscription(email) to verify user.');
      
      return this;
    }

    // Main method: Check if email has active subscription
    async checkSubscription(email) {
      if (!this.initialized || !this.merchantId) {
        console.error('❌ SDK not initialized. Call init(merchantId) first.');
        return false;
      }

      if (!email) {
        console.error('❌ Email is required to check subscription');
        return false;
      }

      try {
        console.log('🔍 Checking subscription for:', email);
        console.log('🏪 Merchant ID:', this.merchantId);
        
        const response = await fetch(`${this.apiBase}/check-subscription`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            email: email.toLowerCase().trim(),
            merchant_id: this.merchantId 
          })
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
          }
          console.error('❌ Subscription check failed:', errorData);
          console.error('❌ Status:', response.status);
          console.error('❌ Error details:', errorData.error || errorData);
          this.subscriber = null;
          return false;
        }

        const data = await response.json();
        
        if (data.has_subscription) {
          this.subscriber = data.subscriber;
          console.log('✅ Active subscription found');
          console.log('📋 Plan:', data.subscriber.plan);
          console.log('📋 Status:', data.subscriber.status);
          
          // Trigger custom event
          window.dispatchEvent(new CustomEvent('substrack:subscription-verified', {
            detail: { subscriber: this.subscriber }
          }));
          
          return true;
        } else {
          console.log('ℹ️ No active subscription found');
          this.subscriber = null;
          
          // Trigger custom event
          window.dispatchEvent(new CustomEvent('substrack:no-subscription'));
          
          return false;
        }
      } catch (error) {
        console.error('❌ Error checking subscription:', error);
        this.subscriber = null;
        return false;
      }
    }

    // Check if user has active subscription (after calling checkSubscription)
    hasSubscription() {
      return this.subscriber !== null && this.subscriber.status === 'active';
    }

    // Check if user has specific feature
    hasFeature(featureName) {
      if (!this.hasSubscription()) {
        return false;
      }
      
      return this.subscriber.features && this.subscriber.features.includes(featureName);
    }

    // Get subscriber info
    getSubscriber() {
      return this.subscriber;
    }

    // Get current plan name
    getPlan() {
      return this.subscriber?.plan || null;
    }

    // Get subscription status
    getStatus() {
      return this.subscriber?.status || null;
    }

    // Get next renewal date
    getNextRenewalDate() {
      return this.subscriber?.next_renewal_date || null;
    }

    // Clear subscriber data (for logout)
    clearSubscription() {
      this.subscriber = null;
      console.log('🔄 Subscription data cleared');
      
      // Trigger custom event
      window.dispatchEvent(new CustomEvent('substrack:cleared'));
    }

    // Show subscription widget (optional UI helper)
    showWidget(containerId) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`❌ Container ${containerId} not found`);
        return;
      }
      
      if (this.hasSubscription()) {
        container.innerHTML = `
          <div style="padding: 16px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center;">
              <svg style="width: 24px; height: 24px; color: #10b981; margin-right: 12px; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <div>
                <strong style="color: #065f46; display: block;">✅ Active Subscription</strong>
                <p style="margin: 0; font-size: 14px; color: #047857;">${this.subscriber.plan}</p>
                ${this.subscriber.next_renewal_date ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #059669;">Renews: ${new Date(this.subscriber.next_renewal_date).toLocaleDateString()}</p>` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="padding: 16px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center;">
              <svg style="width: 24px; height: 24px; color: #f59e0b; margin-right: 12px; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div>
                <strong style="color: #92400e; display: block;">⚠️ No Active Subscription</strong>
                <p style="margin: 0; font-size: 14px; color: #b45309;">Subscribe to access premium features</p>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  // Expose to window
  window.Substrack = Substrack;

  console.log('✅ Substrack SDK v3.0.0 (Email-Based) loaded');

})(window);