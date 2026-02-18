// supabase/functions/send-email/index.ts - COMPLETE VERSION
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, from, subject, html, attachments, reply_to } = await req.json()

    // Validate required fields
    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html')
    }

    // Get Resend API key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured in Supabase secrets')
    }

    // Prepare email data
    const emailData: any = {
      from: from || 'onboarding@resend.dev', // Default to Resend test domain
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }

    // Add optional fields
    if (reply_to) {
      emailData.reply_to = reply_to
    }

    // Add attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailData.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content, // Base64 string
        content_type: att.content_type || att.type || 'application/pdf',
      }))
    }

    console.log('📧 Sending email to:', to)
    console.log('📎 Attachments:', attachments?.length || 0)

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Resend API error:', data)
      throw new Error(data.message || `Failed to send email: ${response.status}`)
    }

    console.log('✅ Email sent successfully:', data.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          id: data.id,
          to: emailData.to,
        }
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('💥 Email sending error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})