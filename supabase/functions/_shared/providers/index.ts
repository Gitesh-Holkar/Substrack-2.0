
// Import with: import { getProvider } from '../_shared/providers/index.ts'

import type { Merchant } from '../types.ts'
import type { IPaymentProvider } from './interface.ts'
import { StripeProvider } from './stripe.ts'
import { CashfreeProvider } from './cashfree.ts'

export function getProvider(merchant: Merchant): IPaymentProvider {
  switch (merchant.payment_provider) {
    case 'stripe':   return new StripeProvider(merchant)
    case 'cashfree': return new CashfreeProvider(merchant)
    default:         return new CashfreeProvider(merchant)
  }
}

export type { IPaymentProvider }
export { StripeProvider, CashfreeProvider }