// Gateway utility functions for the Substrack dashboard.
// All credential checks MUST go through these helpers instead of
// checking raw gateway fields inside component code.

export type GatewayProvider = 'stripe' | 'cashfree'

interface GatewayCheckMerchant {
  payment_provider: string
  stripe_api_key?: string | null
  stripe_publishable_key?: string | null
  stripe_webhook_secret?: string | null
  cashfree_app_id?: string | null
  cashfree_secret_key?: string | null
}

/**
 * Returns true only if the merchant's currently active gateway
 * has all required credentials saved.
 */
export function isGatewayConfigured(merchant: GatewayCheckMerchant): boolean {
  switch (merchant.payment_provider) {
    case 'stripe':
      return (
        !!merchant.stripe_api_key &&
        !!merchant.stripe_publishable_key &&
        !!merchant.stripe_webhook_secret
      )
    case 'cashfree':
      return !!merchant.cashfree_app_id && !!merchant.cashfree_secret_key
    default:
      return false
  }
}

/**
 * Returns true if a specific gateway has its credentials fully saved,
 * regardless of which gateway is currently active.
 */
export function isGatewayCredentialsSaved(
  merchant: GatewayCheckMerchant,
  provider: GatewayProvider,
): boolean {
  switch (provider) {
    case 'stripe':
      return (
        !!merchant.stripe_api_key &&
        !!merchant.stripe_publishable_key &&
        !!merchant.stripe_webhook_secret
      )
    case 'cashfree':
      return !!merchant.cashfree_app_id && !!merchant.cashfree_secret_key
    default:
      return false
  }
}
