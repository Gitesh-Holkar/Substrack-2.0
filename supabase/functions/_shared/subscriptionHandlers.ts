
// Gateway-agnostic business logic for all subscription lifecycle events.
// Both stripe-webhook and cashfree-webhook call handleNormalizedEvent().
//
// Import with:
//   import { handleNormalizedEvent } from '../_shared/subscriptionHandlers.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import jsPDF from 'https://esm.sh/jspdf@2.5.1'
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2'
import type { NormalizedEvent } from './normalizedEvents.ts'
import type { Merchant } from './types.ts'

type SupabaseClient = ReturnType<typeof createClient>

// ---------------------------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------------------------

export async function handleNormalizedEvent(
  event: NormalizedEvent,
  merchant: Merchant,
  supabase: SupabaseClient,
): Promise<void> {
  switch (event.type) {
    case 'subscription.activated':
      await onSubscriptionActivated(event, merchant, supabase)
      break
    case 'payment.succeeded':
      await onPaymentSucceeded(event, merchant, supabase)
      break
    case 'payment.failed':
      await onPaymentFailed(event, merchant, supabase)
      break
    case 'payment.processing':
      await onPaymentProcessing(event, supabase)
      break
    case 'subscription.cancelled':
      await onSubscriptionCancelled(event, supabase)
      break
    case 'subscription.updated':
      await onSubscriptionUpdated(event, supabase)
      break
    case 'unknown':
      console.log(`Ignoring unhandled event: ${event.rawEventType}`)
      break
  }
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

async function onSubscriptionActivated(
  event: Extract<NormalizedEvent, { type: 'subscription.activated' }>,
  merchant: Merchant,
  supabase: SupabaseClient,
): Promise<void> {
  // Fetch plan details at the top - needed for billing type check and emails
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name, billing_cycle, billing_type, trial_period_days')
    .eq('id', event.planId)
    .single()

  const planName = plan?.name ?? 'Subscription'
  const billingCycle = plan?.billing_cycle ?? 'monthly'

  // Cashfree postpaid and trial plans: the Rs1 authorization charge at signup
  // is a mandate verification step, not real income. Cashfree refunds it automatically.
  // Do not insert a payment transaction for these plans on activation.
  // Do not attach an invoice to the welcome email - no payment was made yet.
  const isCashfreeDeferred = event.provider === 'cashfree' &&
    (plan?.billing_type === 'postpaid' || (plan?.trial_period_days ?? 0) > 0)

  // Check if a pending subscriber row already exists (Cashfree pre-creates one)
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id, status')
    .eq('provider_subscription_id', event.providerSubscriptionId)
    .limit(1)
    .single()

  // Already active - skip (idempotency)
  if (existing && existing.status !== 'pending') {
    console.log('Subscriber already active, skipping:', event.providerSubscriptionId)
    return
  }

  if (existing && existing.status === 'pending') {
    // Update the pending row to active
    await supabase
      .from('subscribers')
      .update({
        status: 'active',
        payment_provider: event.provider,
        provider_customer_id: event.providerCustomerId,
        start_date: event.startDate.toISOString(),
        next_renewal_date: event.nextRenewalDate.toISOString(),
        last_payment_date: isCashfreeDeferred ? null : new Date().toISOString(),
        last_payment_amount: isCashfreeDeferred ? null : event.amount,
      })
      .eq('id', existing.id)

    console.log('Pending subscriber activated:', existing.id)
    await supabase.rpc('increment_subscriber_count', { p_plan_id: event.planId })

    await sendWelcomeEmail({
      supabase,
      toEmail: event.customerEmail,
      customerName: event.customerName,
      merchant,
      subscriberId: existing.id,
      planName,
      amount: event.amount,
      billingCycle,
      transactionId: event.gatewayPaymentId,
      nextRenewalDate: event.nextRenewalDate,
      withInvoice: !isCashfreeDeferred,
    })
    return
  }

  // Migration detection: check if this email cancelled a subscription on this
  // merchant within the last 30 days. If yes, this is a plan transfer not churn.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentlyCancelled } = await supabase
    .from('subscribers')
    .select('id, plan_id')
    .eq('merchant_id', event.merchantId)
    .eq('customer_email', event.customerEmail.toLowerCase().trim())
    .eq('status', 'cancelled')
    .gte('cancelled_at', thirtyDaysAgo)
    .neq('plan_id', event.planId)
    .is('migrated_from_plan_id', null)
    .order('cancelled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const migratedFromPlanId = recentlyCancelled?.plan_id ?? null

  // No existing row - insert new subscriber
  const subscriberRow: Record<string, unknown> = {
    merchant_id: event.merchantId,
    plan_id: event.planId,
    customer_name: event.customerName,
    customer_email: event.customerEmail,
    status: 'active',
    payment_provider: event.provider,
    provider_subscription_id: event.providerSubscriptionId,
    provider_customer_id: event.providerCustomerId,
    start_date: event.startDate.toISOString(),
    next_renewal_date: event.nextRenewalDate.toISOString(),
    last_payment_date: isCashfreeDeferred ? null : new Date().toISOString(),
    last_payment_amount: isCashfreeDeferred ? null : event.amount,
    migrated_from_plan_id: migratedFromPlanId,
  }

  // Keep legacy Stripe columns populated for backwards compatibility
  if (event.provider === 'stripe') {
    subscriberRow.stripe_subscription_id = event.providerSubscriptionId
    subscriberRow.stripe_customer_id = event.providerCustomerId
  }

  const { data: newSubscriber, error } = await supabase
    .from('subscribers')
    .insert(subscriberRow)
    .select()
    .single()

  if (error || !newSubscriber) {
    throw new Error(`Failed to create subscriber: ${error?.message}`)
  }

  console.log('Subscriber created:', newSubscriber.id)

  // Only insert payment transaction when real money was charged.
  // isCashfreeDeferred plans have a Rs1 auth (refunded) at signup - skip it.
  if (event.amount > 0 && !isCashfreeDeferred) {
    const txRow: Record<string, unknown> = {
      merchant_id: event.merchantId,
      subscriber_id: newSubscriber.id,
      plan_id: event.planId,
      amount: event.amount,
      status: 'success',
      payment_provider: event.provider,
      provider_payment_id: event.gatewayPaymentId,
      payment_date: new Date().toISOString(),
    }

    if (event.provider === 'stripe') {
      txRow.stripe_payment_id = event.gatewayPaymentId
    }

    await supabase.from('payment_transactions').insert(txRow)
  }

  await supabase.rpc('increment_subscriber_count', { p_plan_id: event.planId })

  await sendWelcomeEmail({
    supabase,
    toEmail: event.customerEmail,
    customerName: event.customerName,
    merchant,
    subscriberId: newSubscriber.id,
    planName,
    amount: event.amount,
    billingCycle,
    transactionId: event.gatewayPaymentId,
    nextRenewalDate: event.nextRenewalDate,
    withInvoice: !isCashfreeDeferred,
  })
}

async function onPaymentSucceeded(
  event: Extract<NormalizedEvent, { type: 'payment.succeeded' }>,
  merchant: Merchant,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('id, merchant_id, plan_id, customer_name, customer_email, dunning_step')
    .eq('provider_subscription_id', event.providerSubscriptionId)
    .limit(1)
    .single()

  if (!subscriber) {
    console.log('No subscriber found for:', event.providerSubscriptionId)
    return
  }

  // Skip ₹1 mandate authorization charge — it is not a real subscription payment.
  // RBI requires this verification step for UPI AutoPay mandates. It is refunded
  // automatically and must not generate an invoice or appear as a payment record.
  if (event.amount <= 1 && event.provider === 'cashfree') {
    console.log('Skipping ₹1 mandate auth charge for:', event.providerSubscriptionId)
    return
  }

  const updates: Record<string, unknown> = {
    status: 'active',
    last_payment_date: new Date().toISOString(),
    last_payment_amount: event.amount,
    dunning_step: 0,
    dunning_started_at: null,
    next_retry_at: null,
  }
  if (event.nextRenewalDate) {
    updates.next_renewal_date = event.nextRenewalDate.toISOString()
  }

  await supabase.from('subscribers').update(updates).eq('id', subscriber.id)

  // Idempotency: skip if this payment was already recorded
  const { data: existingTx } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('provider_payment_id', event.gatewayPaymentId)
    .limit(1)
    .single()

  if (!existingTx) {
    const txRow: Record<string, unknown> = {
      merchant_id: subscriber.merchant_id,
      subscriber_id: subscriber.id,
      plan_id: subscriber.plan_id,
      amount: event.amount,
      status: 'success',
      payment_provider: event.provider,
      provider_payment_id: event.gatewayPaymentId,
      payment_date: new Date().toISOString(),
    }

    if (event.provider === 'stripe') {
      txRow.stripe_payment_id = event.gatewayPaymentId
    }

    await supabase.from('payment_transactions').insert(txRow)
  }

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name, billing_cycle')
    .eq('id', subscriber.plan_id)
    .single()

  const planName = plan?.name ?? 'Subscription'
  const billingCycle = plan?.billing_cycle ?? 'monthly'
  const nextBilling = event.nextRenewalDate ? formatDate(event.nextRenewalDate) : 'N/A'

  await sendEmailWithInvoice({
    supabase,
    toEmail: subscriber.customer_email,
    subject: `Payment Received - ${merchant.business_name}`,
    html: getPaymentSuccessEmailHtml(
      subscriber.customer_name,
      planName,
      event.amount,
      merchant.business_name,
      merchant.email,
      nextBilling,
    ),
    merchant,
    subscriberId: subscriber.id,
    planName,
    amount: event.amount,
    billingCycle,
    transactionId: event.gatewayPaymentId,
    isWelcome: false,
  })
}

async function onPaymentFailed(
  event: Extract<NormalizedEvent, { type: 'payment.failed' }>,
  merchant: Merchant,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('id, merchant_id, plan_id, customer_name, customer_email, start_date')
    .eq('provider_subscription_id', event.providerSubscriptionId)
    .limit(1)
    .single()

  if (!subscriber) {
    console.log('No subscriber found for failed payment:', event.providerSubscriptionId)
    return
  }

  // Fetch plan once — used for trial guard and email
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name, trial_period_days, billing_cycle')
    .eq('id', subscriber.plan_id)
    .single()

  // Guard: do not start dunning if subscriber is still within their trial period
  const trialDays = plan?.trial_period_days ?? 0
  if (trialDays > 0 && subscriber.start_date) {
    const trialEndDate = new Date(subscriber.start_date)
    trialEndDate.setDate(trialEndDate.getDate() + trialDays)
    if (new Date() < trialEndDate) {
      console.log('Payment failed during active trial — skipping dunning:', subscriber.id)
      return
    }
  }

  // Record failed transaction with stable idempotency key (no Date.now())
  const failedPaymentId = `failed_${event.providerSubscriptionId}_${event.amount}`

  const { data: existingTx } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('provider_payment_id', failedPaymentId)
    .limit(1)
    .single()

  if (!existingTx) {
    await supabase.from('payment_transactions').insert({
      merchant_id: subscriber.merchant_id,
      subscriber_id: subscriber.id,
      plan_id: subscriber.plan_id,
      amount: event.amount,
      status: 'failed',
      payment_provider: event.provider,
      provider_payment_id: failedPaymentId,
      payment_date: new Date().toISOString(),
    })
  }

  // Start dunning: move to past_due, set step 1, schedule next check in 1 day
  const nextRetryAt = new Date()
  nextRetryAt.setDate(nextRetryAt.getDate() + 1)

  await supabase
    .from('subscribers')
    .update({
      status: 'past_due',
      dunning_step: 1,
      dunning_started_at: new Date().toISOString(),
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq('id', subscriber.id)

  const planName = plan?.name ?? 'Subscription'

  await sendEmail(
    supabase,
    subscriber.customer_email,
    `${merchant.business_name} <no-reply@substrack.work.gd>`,
    `Payment couldn't be processed — ${planName}`,
    getDunningDay1EmailHtml(
      subscriber.customer_name,
      planName,
      event.amount,
      merchant.business_name,
      merchant.email,
    ),
  )

  console.log('Dunning started | subscriber:', subscriber.id, '| step: 1')
}

async function onPaymentProcessing(
  event: Extract<NormalizedEvent, { type: 'payment.processing' }>,
  supabase: SupabaseClient,
): Promise<void> {
  // UPI 24-hour pre-debit window — keep subscriber active, don't send failure email
  // The payment_intent ID is stored as providerSubscriptionId here temporarily.
  // We look up the subscriber via stripe_subscription_id fallback since
  // payment_intent.processing doesn't carry the subscription ID directly.
  console.log('Payment processing (UPI mandate):', event.providerSubscriptionId)

  // No status change, no email — just log and return.
  // invoice.payment_succeeded or invoice.payment_failed will follow.
}

async function onSubscriptionCancelled(
  event: Extract<NormalizedEvent, { type: 'subscription.cancelled' }>,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('id, merchant_id, plan_id, customer_name, customer_email, migrated_from_plan_id')
    .eq('provider_subscription_id', event.providerSubscriptionId)
    .limit(1)
    .single()

  if (!subscriber) {
    console.log('No subscriber found for:', event.providerSubscriptionId)
    return
  }

  await supabase
    .from('subscribers')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriber.id)

  await supabase.rpc('decrement_subscriber_count', { p_plan_id: subscriber.plan_id })

  // Fetch merchant name for resubscribe email from address
  const { data: merchantRow } = await supabase
    .from('merchants')
    .select('business_name')
    .eq('id', subscriber.merchant_id)
    .single()

  // Fetch cancelled plan details
  const { data: cancelledPlan } = await supabase
    .from('subscription_plans')
    .select('name, price, billing_cycle')
    .eq('id', subscriber.plan_id)
    .single()

  // Find next higher-priced active plan for optional upsell (auto-detected by price)
  const { data: higherPlans } = await supabase
    .from('subscription_plans')
    .select('id, name, price, billing_cycle')
    .eq('merchant_id', subscriber.merchant_id)
    .eq('is_active', true)
    .is('archived_at', null)
    .gt('price', cancelledPlan?.price ?? 0)
    .order('price', { ascending: true })
    .limit(1)

  const higherPlan = higherPlans?.[0] ?? null
  const businessName = merchantRow?.business_name ?? 'Your subscription provider'

  // Migrated subscribers already have a new active plan.
  // Do not send a cancellation email — the old subscription ending is expected.
  if (subscriber.migrated_from_plan_id) {
    console.log('Subscription cancelled for migrated subscriber — skipping cancellation email:', subscriber.id)
    return
  }

  if (cancelledPlan) {
    const resubscribeUrl = `https://substrack.work.gd/subscribe/${subscriber.plan_id}`
    const higherPlanUrl = higherPlan
      ? `https://substrack.work.gd/subscribe/${higherPlan.id}`
      : null

    await sendEmail(
      supabase,
      subscriber.customer_email,
      `${businessName} <no-reply@substrack.work.gd>`,
      `Your subscription has been cancelled`,
      getResubscribeEmailHtml(
        subscriber.customer_name,
        cancelledPlan.name,
        businessName,
        resubscribeUrl,
        higherPlan && higherPlanUrl
          ? {
              name: higherPlan.name,
              price: higherPlan.price,
              billing_cycle: higherPlan.billing_cycle,
              url: higherPlanUrl,
            }
          : null,
      ),
    )
  }

  console.log('Subscription cancelled:', event.providerSubscriptionId)
}

async function onSubscriptionUpdated(
  event: Extract<NormalizedEvent, { type: 'subscription.updated' }>,
  supabase: SupabaseClient,
): Promise<void> {
  if (!event.nextRenewalDate) return

  await supabase
    .from('subscribers')
    .update({ next_renewal_date: event.nextRenewalDate.toISOString() })
    .eq('provider_subscription_id', event.providerSubscriptionId)
}

// ---------------------------------------------------------------------------
// EMAIL HELPERS
// ---------------------------------------------------------------------------

async function sendEmail(
  supabase: SupabaseClient,
  to: string,
  from: string,
  subject: string,
  html: string,
  attachment?: { filename: string; content: string; content_type: string },
): Promise<void> {
  try {
    const body: Record<string, unknown> = { to, from, subject, html }
    if (attachment) body.attachments = [attachment]

    const { error } = await supabase.functions.invoke('send-email', { body })
    if (error) console.error('Failed to send email:', error)
  } catch (err) {
    console.error('sendEmail error:', err)
  }
}

async function sendEmailWithInvoice(params: {
  supabase: SupabaseClient
  toEmail: string
  subject: string
  html: string
  merchant: Merchant
  subscriberId: string
  planName: string
  amount: number
  billingCycle: string
  transactionId: string
  isWelcome: boolean
}): Promise<void> {
  const { supabase, toEmail, subject, html, merchant, subscriberId, planName, amount, billingCycle, transactionId } = params

  try {
    const invoiceId = `INV-${new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2)}-${subscriberId.substring(0, 8).toUpperCase()}`
    const pdfBase64 = await generateInvoicePDF({
      invoiceId,
      merchantName: merchant.business_name,
      merchantEmail: merchant.email,
      merchantAddress: merchant.business_address ?? undefined,
      merchantGST: merchant.gst_number ?? undefined,
      merchantLogo: merchant.logo_url ?? undefined,
      planName,
      amount,
      billingCycle,
      transactionId,
    })

    await sendEmail(
      supabase,
      toEmail,
      `${merchant.business_name} <no-reply@substrack.work.gd>`,
      subject,
      html,
      { filename: `${invoiceId}.pdf`, content: pdfBase64, content_type: 'application/pdf' },
    )
  } catch (err) {
    console.error('sendEmailWithInvoice error — sending without PDF:', err)
    // Still send the email even if PDF generation fails
    await sendEmail(
      supabase,
      toEmail,
      `${merchant.business_name} <no-reply@substrack.work.gd>`,
      subject,
      html,
    )
  }
}

async function sendWelcomeEmail(params: {
  supabase: SupabaseClient
  toEmail: string
  customerName: string
  merchant: Merchant
  subscriberId: string
  planName: string
  amount: number
  billingCycle: string
  transactionId: string
  nextRenewalDate: Date
  withInvoice: boolean
}): Promise<void> {
  const {
    supabase, toEmail, customerName, merchant, subscriberId,
    planName, amount, billingCycle, transactionId, nextRenewalDate, withInvoice,
  } = params

  const subject = `Welcome to ${merchant.business_name}! Your subscription is active`

  if (withInvoice) {
    // Prepaid plan: real payment was made - attach invoice
    await sendEmailWithInvoice({
      supabase,
      toEmail,
      subject,
      html: getWelcomeEmailHtml(
        customerName,
        planName,
        amount,
        merchant.business_name,
        merchant.email,
        formatDate(nextRenewalDate),
      ),
      merchant,
      subscriberId,
      planName,
      amount,
      billingCycle,
      transactionId,
      isWelcome: true,
    })
  } else {
    // Postpaid or Trial plan: no payment made yet - send welcome without invoice
    await sendEmail(
      supabase,
      toEmail,
      `${merchant.business_name} <no-reply@substrack.work.gd>`,
      subject,
      getWelcomeEmailDeferredHtml(
        customerName,
        planName,
        amount,
        merchant.business_name,
        merchant.email,
        formatDate(nextRenewalDate),
      ),
    )
  }
}

// ---------------------------------------------------------------------------
// PDF GENERATION
// ---------------------------------------------------------------------------

async function generateInvoicePDF(data: {
  invoiceId: string
  merchantName: string
  merchantEmail: string
  merchantAddress?: string
  merchantGST?: string
  merchantLogo?: string
  planName: string
  amount: number
  billingCycle: string
  transactionId: string
}): Promise<string> {
  const doc = new jsPDF()
  const primary: [number, number, number] = [79, 70, 229]
  const text: [number, number, number] = [55, 65, 81]
  const light: [number, number, number] = [243, 244, 246]
  let y = 20

  if (data.merchantLogo) {
    try {
      const res = await fetch(data.merchantLogo)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''))
        const ct = res.headers.get('content-type') ?? 'image/png'
        const type = ct.includes('jpeg') || ct.includes('jpg') ? 'JPEG' : 'PNG'
        doc.addImage(`data:${ct};base64,${b64}`, type, 20, y - 5, 30, 30)
      }
    } catch { /* skip logo on error */ }
  }

  const nameX = data.merchantLogo ? 55 : 20
  doc.setFontSize(20).setTextColor(...primary).setFont('helvetica', 'bold')
  doc.text(data.merchantName, nameX, y + 5)
  doc.setFontSize(24).setTextColor(...text)
  doc.text('INVOICE', 190, y + 5, { align: 'right' })
  y += 35

  doc.setFontSize(9).setTextColor(...text).setFont('helvetica', 'normal')
  doc.text(`Invoice No: ${data.invoiceId}`, 20, y)
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, y + 5)
  if (data.merchantAddress) doc.text(data.merchantAddress, 20, y + 10)
  if (data.merchantGST) doc.text(`GSTIN: ${data.merchantGST}`, 20, y + 15)
  doc.text(data.merchantEmail, 20, y + 20)
  y += 30

  doc.setDrawColor(...light)
  doc.line(20, y, 190, y)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Billing Cycle', 'Amount (INR)']],
    body: [[data.planName, data.billingCycle, data.amount.toFixed(2)]],
    theme: 'striped',
    headStyles: { fillColor: primary, textColor: 255, fontSize: 10 },
    bodyStyles: { textColor: text, fontSize: 10 },
    columnStyles: { 2: { halign: 'right' } },
    margin: { left: 20, right: 20 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(...primary)
  doc.text(`Total: INR ${data.amount.toFixed(2)}`, 190, finalY, { align: 'right' })

  if (data.transactionId) {
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...text)
    doc.text(`Transaction ID: ${data.transactionId}`, 20, finalY + 10)
  }

  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...light).line(20, pageH - 20, 190, pageH - 20)
  doc.setFontSize(8).setTextColor(100, 116, 139)
  doc.text('Thank you for your business!', 105, pageH - 14, { align: 'center' })

  return doc.output('datauristring').split(',')[1]
}

// ---------------------------------------------------------------------------
// EMAIL TEMPLATES
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function baseEmailWrapper(headerColor: string, headerText: string, body: string): string {
  return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
    .container{max-width:600px;margin:0 auto;padding:20px}
    .header{background:${headerColor};color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}
    .content{background:#f9fafb;padding:30px;border-radius:0 0 8px 8px}
    .card{background:white;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}
    .row:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:30px;color:#6b7280;font-size:13px}
  </style></head><body><div class="container">
    <div class="header"><h1 style="margin:0;font-size:22px">${headerText}</h1></div>
    <div class="content">${body}</div>
  </div></body></html>`
}

function getWelcomeEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
  nextBillingDate: string,
): string {
  return baseEmailWrapper('#4F46E5', `🎉 Welcome to ${merchantName}!`, `
    <p>Hi ${customerName},</p>
    <p>Thank you for subscribing! Your subscription is now active.</p>
    <div class="card">
      <div class="row"><span><b>Plan</b></span><span>${planName}</span></div>
      <div class="row"><span><b>Amount</b></span><span>₹${amount.toFixed(2)}</span></div>
      <div class="row"><span><b>Status</b></span><span style="color:#10b981;font-weight:bold">Active</span></div>
      <div class="row"><span><b>Next Billing</b></span><span>${nextBillingDate}</span></div>
    </div>
    <p>Your invoice is attached to this email.</p>
    <div class="footer"><p>Questions? Contact us at ${merchantEmail}</p></div>
  `)
}

function getWelcomeEmailDeferredHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
  firstChargeDate: string,
): string {
  return baseEmailWrapper('#4F46E5', `🎉 Welcome to ${merchantName}!`, `
    <p>Hi ${customerName},</p>
    <p>Thank you for subscribing! Your subscription mandate is now active and confirmed.</p>
    <div class="card">
      <div class="row"><span><b>Plan</b></span><span>${planName}</span></div>
      <div class="row"><span><b>Subscription Amount</b></span><span>₹${amount.toFixed(2)}</span></div>
      <div class="row"><span><b>Status</b></span><span style="color:#10b981;font-weight:bold">Active</span></div>
      <div class="row"><span><b>First Charge Date</b></span><span>${firstChargeDate}</span></div>
    </div>
    <p>No payment has been charged yet. Your first invoice will be sent on your first charge date.</p>
    <div class="footer"><p>Questions? Contact us at ${merchantEmail}</p></div>
  `)
}

function getPaymentSuccessEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
  nextBillingDate: string,
): string {
  return baseEmailWrapper('#10b981', '💳 Payment Received', `
    <p>Hi ${customerName},</p>
    <p>Your payment has been successfully processed!</p>
    <div class="card">
      <div class="row"><span><b>Plan</b></span><span>${planName}</span></div>
      <div class="row"><span><b>Amount Paid</b></span><span>₹${amount.toFixed(2)}</span></div>
      <div class="row"><span><b>Next Billing</b></span><span>${nextBillingDate}</span></div>
    </div>
    <p>Your invoice is attached to this email.</p>
    <div class="footer"><p>Questions? Contact us at ${merchantEmail}</p><p style="font-size:12px;color:#9ca3af">Automated receipt from ${merchantName}</p></div>
  `)
}

function getPaymentFailedEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
): string {
  return baseEmailWrapper('#ef4444', '⚠️ Payment Failed', `
    <p>Hi ${customerName},</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;padding:15px;border-radius:6px;margin:16px 0">
      <p style="margin:0;color:#991b1b"><b>We couldn't process your payment.</b></p>
      <p style="margin:8px 0 0;color:#991b1b">Your subscription may be at risk of cancellation.</p>
    </div>
    <div class="card">
      <div class="row"><span><b>Plan</b></span><span>${planName}</span></div>
      <div class="row"><span><b>Amount</b></span><span>₹${amount.toFixed(2)}</span></div>
      <div class="row"><span><b>Status</b></span><span style="color:#ef4444">Failed</span></div>
    </div>
    <p>Please update your payment method to continue your subscription.</p>
    <div class="footer"><p>Need help? Contact ${merchantEmail}</p><p style="font-size:12px;color:#9ca3af">Automated notice from ${merchantName}</p></div>
  `)
}

// ---------------------------------------------------------------------------
// DUNNING + RESUBSCRIBE EMAIL HELPERS
// ---------------------------------------------------------------------------

function getDunningDay1EmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  businessName: string,
  merchantEmail: string,
): string {
  return baseEmailWrapper('#f59e0b', `Payment couldn't be processed`, `
    <p>Hi ${customerName},</p>
    <p>We were unable to process your payment of <strong>₹${amount.toFixed(2)}</strong> for your <strong>${planName}</strong> subscription with ${businessName}.</p>
    <p>This can happen due to insufficient balance, a bank restriction, or a UPI mandate issue. <strong>No action is needed right now</strong> — we will attempt to process it again in a day.</p>
    <p>If you would like to ensure there is no interruption, please check your UPI autopay settings or card details with your bank.</p>
    <div class="footer">
      <p>Questions? Contact us at ${merchantEmail}</p>
      <p style="font-size:12px;color:#9ca3af">Automated notice from ${businessName}</p>
    </div>
  `)
}

function getDunningDay3EmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  businessName: string,
  merchantEmail: string,
): string {
  return baseEmailWrapper('#f59e0b', `Payment still pending — action may be needed`, `
    <p>Hi ${customerName},</p>
    <p>We have been unable to process your payment of <strong>₹${amount.toFixed(2)}</strong> for your <strong>${planName}</strong> subscription with ${businessName}.</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;padding:15px;border-radius:6px;margin:16px 0">
      <p style="margin:0;color:#92400e">To avoid any interruption to your subscription, please check your UPI autopay mandate or ensure your payment method has sufficient balance.</p>
    </div>
    <p>We will try once more in a few days.</p>
    <div class="footer">
      <p>Questions? Contact us at ${merchantEmail}</p>
      <p style="font-size:12px;color:#9ca3af">Automated notice from ${businessName}</p>
    </div>
  `)
}

function getDunningDay7EmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  businessName: string,
  merchantEmail: string,
): string {
  return baseEmailWrapper('#ef4444', `Final notice — subscription at risk`, `
    <p>Hi ${customerName},</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;padding:15px;border-radius:6px;margin:16px 0">
      <p style="margin:0;color:#991b1b"><strong>This is our final attempt to collect your payment of ₹${amount.toFixed(2)} for ${planName}.</strong></p>
      <p style="margin:8px 0 0;color:#991b1b">If payment cannot be collected, your subscription will be cancelled.</p>
    </div>
    <p>Please check your UPI mandate or payment method immediately. Contact us if you believe this is an error.</p>
    <div class="footer">
      <p>Questions? Contact us at ${merchantEmail}</p>
      <p style="font-size:12px;color:#9ca3af">Automated notice from ${businessName}</p>
    </div>
  `)
}

function getResubscribeEmailHtml(
  customerName: string,
  planName: string,
  businessName: string,
  resubscribeUrl: string,
  higherPlan: {
    name: string
    price: number
    billing_cycle: string
    url: string
  } | null,
): string {
  const upsellSection = higherPlan
    ? `
    <div style="margin:24px 0;padding:16px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd">
      <p style="color:#0369a1;font-weight:600;margin:0 0 4px">Or explore an upgrade</p>
      <p style="color:#374151;font-size:14px;margin:0 0 12px">${higherPlan.name} — ₹${higherPlan.price.toFixed(2)} / ${higherPlan.billing_cycle}</p>
      <a href="${higherPlan.url}" style="display:inline-block;padding:10px 20px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">Explore ${higherPlan.name}</a>
    </div>`
    : ''

  return baseEmailWrapper('#6b7280', `Your subscription has been cancelled`, `
    <p>Hi ${customerName},</p>
    <p>Your <strong>${planName}</strong> subscription with ${businessName} has been cancelled.</p>
    <p>You can resubscribe anytime — your history is saved.</p>
    <div style="margin:24px 0">
      <a href="${resubscribeUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Resubscribe to ${planName}</a>
    </div>
    ${upsellSection}
    <div class="footer">
      <p style="font-size:12px;color:#9ca3af">You received this because you had an active subscription with ${businessName}.</p>
    </div>
  `)
}
