// app/(dashboard)/contact/page.tsx
'use client'

import { useState } from 'react'
import { Mail, Copy, Check, MessageCircle, HelpCircle } from 'lucide-react'

export default function ContactUs() {
  const [copied, setCopied] = useState(false)
  const supportEmail = 'support@substrack-yags.vercel.app'

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    
      <div className='max-w-3xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h2 className='text-2xl font-bold text-gray-800 mb-2'>Get in Touch</h2>
          <p className='text-gray-600'>We&apos;re here to help with any questions or concerns</p>
        </div>

        {/* Main Contact Card */}
        <div className='bg-white rounded-xl shadow-sm p-8 mb-6'>
          <div className='text-center'>
            <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6'>
              <Mail className='w-8 h-8 text-blue-600' />
            </div>
            
            <p className='text-gray-600 mb-8'>
              For support, inquiries, or feedback, please reach out to us via email
            </p>

            {/* Email Display */}
            <div className='bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6'>
              <p className='text-sm text-gray-500 mb-2 font-medium'>Support Email</p>
              <div className='flex items-center justify-center gap-3'>
                <a 
                  href={`mailto:${supportEmail}`}
                  className='text-2xl font-semibold text-blue-600 hover:text-blue-700 transition-colors'
                >
                  {supportEmail}
                </a>
              </div>
            </div>

            {/* Action Button */}
            <div className='flex justify-center'>
              <button
                onClick={handleCopyEmail}
                className='flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium'
              >
                {copied ? (
                  <>
                    <Check className='w-5 h-5' />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className='w-5 h-5' />
                    Copy Email Address
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className='grid md:grid-cols-2 gap-6 mb-6'>
          {/* Response Time */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <div className='flex items-start gap-4'>
              <div className='w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0'>
                <MessageCircle className='w-6 h-6 text-green-600' />
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 mb-2'>Response Time</h3>
                <p className='text-sm text-gray-600'>
                  We typically respond within 24-48 hours during business days
                </p>
              </div>
            </div>
          </div>

          {/* What to Include */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <div className='flex items-start gap-4'>
              <div className='w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0'>
                <HelpCircle className='w-6 h-6 text-purple-600' />
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 mb-2'>What to Include</h3>
                <p className='text-sm text-gray-600'>
                  Please include your account details and a clear description of your issue
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className='bg-white rounded-xl shadow-sm p-8'>
          <h2 className='text-xl font-semibold text-gray-800 mb-6 text-center'>
            Common Topics We Can Help With
          </h2>
          
          <div className='grid md:grid-cols-2 gap-4'>
            <div className='flex items-start gap-3 p-4 bg-blue-50 rounded-lg'>
              <div className='w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0'></div>
              <div>
                <h4 className='font-semibold text-gray-900 mb-1'>Account Issues</h4>
                <p className='text-sm text-gray-600'>Login problems, password resets, account setup</p>
              </div>
            </div>

            <div className='flex items-start gap-3 p-4 bg-green-50 rounded-lg'>
              <div className='w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0'></div>
              <div>
                <h4 className='font-semibold text-gray-900 mb-1'>Payment & Billing</h4>
                <p className='text-sm text-gray-600'>Stripe integration, invoice questions, refunds</p>
              </div>
            </div>

            <div className='flex items-start gap-3 p-4 bg-purple-50 rounded-lg'>
              <div className='w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0'></div>
              <div>
                <h4 className='font-semibold text-gray-900 mb-1'>Technical Support</h4>
                <p className='text-sm text-gray-600'>Widget integration, API issues, bugs</p>
              </div>
            </div>

            <div className='flex items-start gap-3 p-4 bg-orange-50 rounded-lg'>
              <div className='w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0'></div>
              <div>
                <h4 className='font-semibold text-gray-900 mb-1'>Feature Requests</h4>
                <p className='text-sm text-gray-600'>Suggestions, feedback, new feature ideas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    
  )
}