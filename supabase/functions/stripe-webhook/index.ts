// supabase/functions/stripe-webhook/index.ts - FIXED LOGO LOADING
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import jsPDF from 'https://esm.sh/jspdf@2.5.1'
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)


// Invoice Data Interface
interface InvoiceData {
  invoiceId: string
  invoiceDate: string
  dueDate?: string
  merchantName: string
  merchantEmail: string
  merchantAddress?: string
  merchantGST?: string
  merchantPhone?: string
  merchantLogo?: string
  customerName: string
  customerEmail: string
  planName: string
  planDescription?: string
  amount: number
  currency: string
  status: string
  paymentMethod?: string
  transactionId?: string
  billingCycle?: string
}

// Generate Invoice PDF as Base64
async function generateInvoicePDFBase64(data: InvoiceData): Promise<string> {
  const doc = new jsPDF()

  const primaryColor: [number, number, number] = [79, 70, 229]
  const textColor: [number, number, number] = [55, 65, 81]
  const lightGray: [number, number, number] = [243, 244, 246]

  let currentY = 20

  // HEADER SECTION
  if (data.merchantLogo) {
    try {
      console.log('📥 Fetching merchant logo...')
      const logoResponse = await fetch(data.merchantLogo)

      if (logoResponse.ok) {
        const logoBlob = await logoResponse.arrayBuffer()
        const logoBase64 = btoa(
          new Uint8Array(logoBlob).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        )

        // Determine image type from URL or content-type
        const contentType =
          logoResponse.headers.get('content-type') || 'image/png'
        const imageType =
          contentType.includes('jpeg') || contentType.includes('jpg')
            ? 'JPEG'
            : 'PNG'

        const logoDataUrl = `data:${contentType};base64,${logoBase64}`
        doc.addImage(logoDataUrl, imageType, 20, currentY - 5, 30, 30)
        console.log('✅ Logo added to PDF')
      } else {
        console.log('⚠️ Logo fetch failed with status:', logoResponse.status)
      }
    } catch (error) {
      console.log('⚠️ Error loading logo, continuing without it:', error)
    }
  }

  const nameX = data.merchantLogo ? 55 : 20
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.text(data.merchantName, nameX, currentY + 5)

  doc.setFontSize(28)
  doc.setTextColor(...textColor)
  doc.text('INVOICE', 190, currentY + 5, { align: 'right' })

  currentY += data.merchantLogo ? 35 : 15

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text(data.merchantEmail, 20, currentY)
  currentY += 5

  if (data.merchantPhone) {
    doc.text(data.merchantPhone, 20, currentY)
    currentY += 5
  }

  if (data.merchantAddress) {
    const addressLines = doc.splitTextToSize(data.merchantAddress, 80)
    doc.text(addressLines, 20, currentY)
    currentY += addressLines.length * 5
  }

  if (data.merchantGST) {
    doc.text(`GST: ${data.merchantGST}`, 20, currentY)
    currentY += 5
  }

  currentY = Math.max(currentY, 60)

  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.5)
  doc.line(20, currentY, 190, currentY)

  currentY += 10

  // INVOICE DETAILS
  const detailsStartY = currentY

  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice Number:', 20, currentY)
  doc.setFont('helvetica', 'normal')
  doc.text(data.invoiceId, 60, currentY)

  currentY += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice Date:', 20, currentY)
  doc.setFont('helvetica', 'normal')
  doc.text(data.invoiceDate, 60, currentY)

  if (data.dueDate) {
    currentY += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Due Date:', 20, currentY)
    doc.setFont('helvetica', 'normal')
    doc.text(data.dueDate, 60, currentY)
  }

  currentY += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Status:', 20, currentY)
  doc.setFont('helvetica', 'normal')

  if (data.status === 'success') {
    doc.setTextColor(22, 163, 74)
    doc.text('PAID', 60, currentY)
  } else if (data.status === 'failed') {
    doc.setTextColor(220, 38, 38)
    doc.text('FAILED', 60, currentY)
  } else {
    doc.setTextColor(234, 179, 8)
    doc.text('PENDING', 60, currentY)
  }

  doc.setTextColor(...textColor)

  const rightX = 120
  let rightY = detailsStartY

  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', rightX, rightY)

  rightY += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.customerName, rightX, rightY)

  rightY += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(data.customerEmail, rightX, rightY)

  currentY = Math.max(currentY, rightY) + 15

  doc.setTextColor(...textColor)

  const totalAmount = data.amount
  const baseAmount = totalAmount / 1.18
  const gstAmount = totalAmount - baseAmount

  const tableData = [
    [
      data.planName,
      data.planDescription || data.billingCycle || 'Subscription',
      '1',
      `INR ${baseAmount.toFixed(2)}`,
      `INR ${baseAmount.toFixed(2)}`,
    ],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Description', 'Details', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 32.5, halign: 'right' },
      4: { cellWidth: 32.5, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  const totalsX = 125
  let totalsY = finalY

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totalsX, totalsY)
  doc.text(`INR ${baseAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })

  totalsY += 6

  doc.text('Tax (18%):', totalsX, totalsY)
  doc.text(`INR ${gstAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })
  totalsY += 6

  doc.setDrawColor(...lightGray)
  doc.line(totalsX, totalsY, 190, totalsY)
  totalsY += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total Amount:', totalsX, totalsY)
  doc.setTextColor(...primaryColor)
  doc.text(`INR ${totalAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })

  doc.setTextColor(...textColor)

  if (data.transactionId || data.paymentMethod) {
    if (totalsY > 240) {
      doc.addPage()
      totalsY = 20
    } else {
      totalsY += 15
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Payment Information:', 20, totalsY)

    totalsY += 5
    doc.setFont('helvetica', 'normal')

    if (data.paymentMethod) {
      doc.text(`Payment Method: ${data.paymentMethod}`, 20, totalsY)
      totalsY += 4
    }

    if (data.transactionId) {
      doc.text(`Transaction ID: ${data.transactionId}`, 20, totalsY)
    }
  }

  const pageHeight =
    doc.internal.pageSize.height || doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 20

  doc.setDrawColor(...lightGray)
  doc.line(20, footerY, 190, footerY)

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text('Thank you for your business!', 105, footerY + 5, {
    align: 'center',
  })
  doc.text(
    'For any queries, please contact us at ' + data.merchantEmail,
    105,
    footerY + 10,
    { align: 'center' }
  )

  const pdfBase64 = doc.output('datauristring').split(',')[1]
  return pdfBase64
}

// Email sending function
async function sendEmailWithAttachment(
  to: string,
  from: string,
  subject: string,
  html: string,
  attachment?: any
) {
  try {
    console.log('📧 Calling send-email function for:', to)

    const body: any = {
      to,
      from,
      subject,
      html,
    }

    if (attachment) {
      body.attachments = [attachment]
    }

    const { data, error } = await supabase.functions.invoke('send-email', {
      body,
    })

    if (error) {
      console.error('❌ Error calling send-email function:', error)
      throw error
    }

    if (!data?.success) {
      console.error('❌ Send-email returned error:', data?.error)
      throw new Error(data?.error || 'Failed to send email')
    }

    console.log('✅ Email sent successfully:', data.data?.id)
  } catch (error: any) {
    console.error('💥 Error sending email:', error.message)
  }
}

// Email templates
function getWelcomeEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
  nextBillingDate: string
) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        h1 { margin: 0; font-size: 24px; }
        .detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to ${merchantName}!</h1>
        </div>
        <div class="content">
          <p>Hi ${customerName},</p>
          <p>Thank you for subscribing! Your subscription is now active.</p>
          
          <div class="card">
            <h2 style="margin-top: 0; color: #4F46E5;">Subscription Details</h2>
            <div class="detail">
              <span><strong>Plan:</strong></span>
              <span>${planName}</span>
            </div>
            <div class="detail">
              <span><strong>Amount:</strong></span>
              <span>₹${amount.toFixed(2)}</span>
            </div>
            <div class="detail">
              <span><strong>Status:</strong></span>
              <span style="color: #10b981; font-weight: bold;">Active</span>
            </div>
            <div class="detail">
              <span><strong>Next Billing Date:</strong></span>
              <span>${nextBillingDate}</span>
            </div>
          </div>

          <p>Your payment has been successfully processed. You now have full access to all features included in your plan.</p>
          <p><strong>Your invoice is attached to this email.</strong></p>
          
          <div class="footer">
            <p>Questions? Contact us at ${merchantEmail}</p>
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated message from ${merchantName}. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

function getPaymentSuccessEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string,
  nextBillingDate: string
) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        h1 { margin: 0; font-size: 24px; }
        .detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail:last-child { border-bottom: none; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💳 Payment Received</h1>
        </div>
        <div class="content">
          <div class="success-icon">✅</div>
          <p>Hi ${customerName},</p>
          <p>Your payment has been successfully processed!</p>
          
          <div class="card">
            <h2 style="margin-top: 0; color: #10b981;">Payment Details</h2>
            <div class="detail">
              <span><strong>Plan:</strong></span>
              <span>${planName}</span>
            </div>
            <div class="detail">
              <span><strong>Amount Paid:</strong></span>
              <span>₹${amount.toFixed(2)}</span>
            </div>
            <div class="detail">
              <span><strong>Payment Date:</strong></span>
              <span>${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}</span>
            </div>
            <div class="detail">
              <span><strong>Next Billing Date:</strong></span>
              <span>${nextBillingDate}</span>
            </div>
          </div>

          <p>Your subscription remains active. Thank you for your continued support!</p>
          <p><strong>Your invoice is attached to this email.</strong></p>
          
          <div class="footer">
            <p>Questions? Contact us at ${merchantEmail}</p>
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated receipt from ${merchantName}.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

function getPaymentFailedEmailHtml(
  customerName: string,
  planName: string,
  amount: number,
  merchantName: string,
  merchantEmail: string
) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        h1 { margin: 0; font-size: 24px; }
        .warning-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Payment Failed</h1>
        </div>
        <div class="content">
          <div class="warning-icon">❌</div>
          <p>Hi ${customerName},</p>
          
          <div class="alert">
            <p style="margin: 0; color: #991b1b;"><strong>We couldn't process your payment</strong></p>
            <p style="margin: 10px 0 0 0; color: #991b1b;">Your subscription may be at risk of cancellation.</p>
          </div>
          
          <div class="card">
            <h2 style="margin-top: 0; color: #ef4444;">Payment Details</h2>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Amount:</strong> ₹${amount.toFixed(2)}</p>
            <p><strong>Status:</strong> <span style="color: #ef4444;">Failed</span></p>
          </div>

          <p><strong>What should you do?</strong></p>
          <ul>
            <li>Check if your payment method has sufficient funds</li>
            <li>Verify your card details are up to date</li>
            <li>Contact your bank if the issue persists</li>
          </ul>

          <p>Please update your payment information to continue enjoying uninterrupted service.</p>
          
          <div class="footer">
            <p>Need help? Contact us at ${merchantEmail}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('❌ No signature provided')
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const parsedBody = JSON.parse(body)

    console.log('🔧 Event type:', parsedBody.type)

    let merchantId = parsedBody.data?.object?.metadata?.merchant_id

    if (!merchantId && parsedBody.data?.object?.subscription_data?.metadata) {
      merchantId = parsedBody.data.object.subscription_data.metadata.merchant_id
    }

    if (
      !merchantId &&
      parsedBody.data?.object?.lines?.data?.[0]?.metadata?.merchant_id
    ) {
      merchantId = parsedBody.data.object.lines.data[0].metadata.merchant_id
    }

    if (!merchantId) {
      const subscriptionId = parsedBody.data?.object?.subscription

      if (subscriptionId) {
        const { data: subscriber } = await supabase
          .from('subscribers')
          .select('merchant_id')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1)
          .single()

        if (subscriber) {
          merchantId = subscriber.merchant_id
        }
      }
    }

    if (!merchantId) {
      console.error('❌ No merchant_id found')
      return new Response('No merchant_id found', { status: 400 })
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'stripe_api_key, stripe_webhook_secret, business_name, email, bank_account, gst_number, logo_url, phone'
      )
      .eq('id', merchantId)
      .single()

    if (merchantError || !merchant?.stripe_api_key) {
      console.error('❌ Merchant not found:', merchantError)
      return new Response('Merchant not found', { status: 400 })
    }

    if (!merchant.stripe_webhook_secret) {
      console.error('❌ Webhook secret not configured')
      return new Response('Webhook secret not configured', { status: 400 })
    }

    const stripe = new Stripe(merchant.stripe_api_key, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const webhookSecret = merchant.stripe_webhook_secret

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )

    console.log('🔧 Webhook event type:', event.type)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          stripe,
          merchant
        )
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        )
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        )
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(
          event.data.object as Stripe.Invoice,
          merchant
        )
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, merchant)
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('💥 Webhook error:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  merchant: any
) {
  console.log('🎉 Processing checkout.session.completed')

  const {
    customer,
    subscription,
    metadata,
    customer_email,
    id: sessionId,
  } = session
  const { plan_id, merchant_id, customer_name } = metadata as any

  if (!subscription) {
    console.error('❌ No subscription in session')
    return
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription as string
    )

    const startDate = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
      : new Date().toISOString()

    const nextRenewalDate = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : null

    const firstInvoiceId = stripeSubscription.latest_invoice
    let paymentAmount = 0
    let planName = 'Unknown Plan'

    if (firstInvoiceId) {
      const invoice =
        typeof firstInvoiceId === 'string'
          ? await stripe.invoices.retrieve(firstInvoiceId)
          : firstInvoiceId

      paymentAmount = (invoice.amount_paid || 0) / 100
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', plan_id)
      .single()

    if (plan) {
      planName = plan.name
    }

    const { data: newSubscriber, error } = await supabase
      .from('subscribers')
      .insert({
        merchant_id,
        plan_id,
        customer_name,
        customer_email,
        status: 'active',
        stripe_subscription_id: subscription,
        stripe_customer_id: customer,
        start_date: startDate,
        next_renewal_date: nextRenewalDate,
        last_payment_date: new Date().toISOString(),
        last_payment_amount: paymentAmount,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating subscriber:', error)
      throw error
    }

    console.log('✅ Subscriber created successfully:', newSubscriber.id)

    
    if (paymentAmount > 0 && newSubscriber) {
      await supabase.from('payment_transactions').insert({
        merchant_id,
        subscriber_id: newSubscriber.id,
        plan_id,
        amount: paymentAmount,
        status: 'success',
        stripe_payment_id:
          typeof firstInvoiceId === 'string'
            ? firstInvoiceId
            : firstInvoiceId?.id,
        payment_date: new Date().toISOString(),
      })
      console.log('✅ Initial payment transaction created')
    }

    await supabase.rpc('increment_subscriber_count', { p_plan_id: plan_id })

    // Generate Invoice PDF
    const invoiceId = `INV-${new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '')
      .substring(2)}-${newSubscriber.id.substring(0, 8).toUpperCase()}`
    const invoiceDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const nextBillingFormatted = nextRenewalDate
      ? new Date(nextRenewalDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A'

    const invoiceData: InvoiceData = {
      invoiceId,
      invoiceDate,
      merchantName: merchant.business_name,
      merchantEmail: merchant.email,
      merchantAddress: merchant.bank_account,
      merchantGST: merchant.gst_number,
      merchantPhone: merchant.phone,
      merchantLogo: merchant.logo_url,
      customerName: customer_name,
      customerEmail: customer_email,
      planName,
      planDescription: 'Subscription Service',
      amount: paymentAmount,
      currency: 'INR',
      status: 'success',
      paymentMethod: 'Stripe',
      transactionId:
        typeof firstInvoiceId === 'string'
          ? firstInvoiceId
          : firstInvoiceId?.id,
      billingCycle: 'Monthly',
    }

    console.log('📄 Generating invoice PDF...')
    const pdfBase64 = await generateInvoicePDFBase64(invoiceData)
    console.log('✅ Invoice PDF generated')

    const fromEmail = `${merchant.business_name} <no-reply@substrack.work.gd>`

    await sendEmailWithAttachment(
      customer_email,
      fromEmail,
      `Welcome to ${merchant.business_name}! Your subscription is active`,
      getWelcomeEmailHtml(
        customer_name,
        planName,
        paymentAmount,
        merchant.business_name,
        merchant.email,
        nextBillingFormatted
      ),
      {
        filename: `${invoiceId}.pdf`,
        content: pdfBase64,
        content_type: 'application/pdf',
      }
    )

    console.log('✅ Welcome email with invoice sent')
  } catch (error) {
    console.error('💥 Failed to process checkout:', error)
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing customer.subscription.updated')

  const nextRenewalDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  await supabase
    .from('subscribers')
    .update({
      status: subscription.status === 'active' ? 'active' : subscription.status,
      next_renewal_date: nextRenewalDate,
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Processing customer.subscription.deleted')

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('plan_id')
    .eq('stripe_subscription_id', subscription.id)
    .limit(1)
    .single()

  await supabase
    .from('subscribers')
    .update({ status: 'cancelled' })
    .eq('stripe_subscription_id', subscription.id)

  if (subscriber) {
    await supabase.rpc('decrement_subscriber_count', {
      p_plan_id: subscriber.plan_id,
    })
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, merchant: any) {
  console.log('💰 Processing invoice.payment_succeeded')

  let subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id

  if (!subscriptionId && invoice.lines?.data?.[0]) {
    const lineItem = invoice.lines.data[0] as any
    subscriptionId = lineItem.subscription
  }

  if (!subscriptionId) {
    console.log('ℹ️ Not a subscription invoice, skipping')
    return
  }

  const { data: subscribers } = await supabase
    .from('subscribers')
    .select(
      'id, merchant_id, plan_id, customer_name, customer_email, next_renewal_date'
    )
    .eq('stripe_subscription_id', subscriptionId)
    .limit(1)

  if (!subscribers || subscribers.length === 0) {
    console.log('⚠️ No subscriber found')
    return
  }

  const subscriber = subscribers[0]
  const paymentAmount = (invoice.amount_paid || 0) / 100

  await supabase
    .from('subscribers')
    .update({
      status: 'active',
      last_payment_date: new Date().toISOString(),
      last_payment_amount: paymentAmount,
    })
    .eq('id', subscriber.id)

  console.log('✅ Subscriber payment info updated')

  const { data: existingTx } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('stripe_payment_id', invoice.id)
    .limit(1)
    .single()

  if (!existingTx) {
    await supabase.from('payment_transactions').insert({
      merchant_id: subscriber.merchant_id,
      subscriber_id: subscriber.id,
      plan_id: subscriber.plan_id,
      amount: paymentAmount,
      status: 'success',
      stripe_payment_id: invoice.id,
      payment_date: new Date().toISOString(),
    })
    console.log('✅ Payment transaction created')
  }

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name')
    .eq('id', subscriber.plan_id)
    .single()

  const planName = plan?.name || 'Unknown Plan'
  const nextBillingFormatted = subscriber.next_renewal_date
    ? new Date(subscriber.next_renewal_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A'

  // Send email only for renewals, not first payment
  if (invoice.billing_reason !== 'subscription_create') {
    const invoiceId = `INV-${new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '')
      .substring(2)}-${subscriber.id.substring(0, 8).toUpperCase()}`
    const invoiceDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const invoiceData: InvoiceData = {
      invoiceId,
      invoiceDate,
      merchantName: merchant.business_name,
      merchantEmail: merchant.email,
      merchantAddress: merchant.bank_account,
      merchantGST: merchant.gst_number,
      merchantPhone: merchant.phone,
      merchantLogo: merchant.logo_url,
      customerName: subscriber.customer_name,
      customerEmail: subscriber.customer_email,
      planName,
      planDescription: 'Subscription Service',
      amount: paymentAmount,
      currency: 'INR',
      status: 'success',
      paymentMethod: 'Stripe',
      transactionId: invoice.id,
      billingCycle: 'Monthly',
    }

    console.log('📄 Generating invoice PDF...')
    const pdfBase64 = await generateInvoicePDFBase64(invoiceData)
    console.log('✅ Invoice PDF generated')

    const fromEmail = `${merchant.business_name}  <no-reply@substrack.work.gd>`

    await sendEmailWithAttachment(
      subscriber.customer_email,
      fromEmail,
      `Payment Received - ${merchant.business_name}`,
      getPaymentSuccessEmailHtml(
        subscriber.customer_name,
        planName,
        paymentAmount,
        merchant.business_name,
        merchant.email,
        nextBillingFormatted
      ),
      {
        filename: `${invoiceId}.pdf`,
        content: pdfBase64,
        content_type: 'application/pdf',
      }
    )
    console.log('✅ Payment success email with invoice sent')
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice, merchant: any) {
  console.log('❌ Processing invoice.payment_failed')

  let subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id

  if (!subscriptionId) {
    return
  }

  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('id, merchant_id, plan_id, customer_name, customer_email')
    .eq('stripe_subscription_id', subscriptionId)
    .limit(1)

  if (!subscribers || subscribers.length === 0) {
    return
  }

  const subscriber = subscribers[0]

  await supabase
    .from('subscribers')
    .update({ status: 'failed' })
    .eq('id', subscriber.id)

  console.log('✅ Subscriber status updated to failed')

  const { data: existingTx } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('stripe_payment_id', invoice.id)
    .limit(1)
    .single()

  if (!existingTx) {
    await supabase.from('payment_transactions').insert({
      merchant_id: subscriber.merchant_id,
      subscriber_id: subscriber.id,
      plan_id: subscriber.plan_id,
      amount: (invoice.amount_due || 0) / 100,
      status: 'failed',
      stripe_payment_id: invoice.id,
      payment_date: new Date().toISOString(),
    })
    console.log('✅ Failed payment transaction created')
  }

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name')
    .eq('id', subscriber.plan_id)
    .single()

  const planName = plan?.name || 'Unknown Plan'
  const amount = (invoice.amount_due || 0) / 100

  const fromEmail = `${merchant.business_name} <no-reply@substrack.work.gd>`

  await sendEmailWithAttachment(
    subscriber.customer_email,
    fromEmail,
    `Payment Failed - Action Required`,
    getPaymentFailedEmailHtml(
      subscriber.customer_name,
      planName,
      amount,
      merchant.business_name,
      merchant.email
    )
  )
  console.log('✅ Payment failed email sent')
}
