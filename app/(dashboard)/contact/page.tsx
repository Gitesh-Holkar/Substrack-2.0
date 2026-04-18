// // app/(dashboard)/contact/page.tsx
// 'use client'

// import { useState } from 'react'
// import Link from 'next/link'
// import {
//   Mail,
//   Copy,
//   Check,
//   ChevronDown,
//   Settings,
//   Users,
//   Puzzle,
//   ArrowRight,
// } from 'lucide-react'

// const SUPPORT_EMAIL = 'support@substrack-yags.vercel.app'

// interface FaqItem {
//   question: string
//   answer: string
// }

// interface FaqGroup {
//   title: string
//   items: FaqItem[]
// }

// const FAQ_GROUPS: FaqGroup[] = [
//   {
//     title: 'Getting Started',
//     items: [
//       {
//         question: 'How do I connect my payment gateway?',
//         answer:
//           'Go to Settings → Payment Setup. You can configure Stripe for international payments or Cashfree for Indian UPI and card payments. Save your credentials, then click "Set as Active Gateway" to start accepting payments. You can configure both gateways and switch between them at any time.',
//       },
//       {
//         question: 'What is the difference between Stripe and Cashfree — which should I use?',
//         answer:
//           'Use Cashfree if your subscribers are primarily in India — it supports UPI Autopay, which is the most common recurring payment method for Indian users. Use Stripe if you have international subscribers or need to accept card payments from outside India. You can configure both and switch between them as your business grows.',
//       },
//       {
//         question: 'How do my customers subscribe to my plans?',
//         answer:
//           'Once you create a plan in the Plans section, copy the payment link and share it — on your website, in a WhatsApp message, or in an email. Your customer clicks the link, fills in their name and email, and completes payment through Stripe or Cashfree. Their subscription is created automatically and appears in your Subscribers list.',
//       },
//     ],
//   },
//   {
//     title: 'Payments & Billing',
//     items: [
//       {
//         question: 'What happens to existing subscribers if I switch payment gateways?',
//         answer:
//           'Existing subscribers stay on the gateway they originally subscribed through until they cancel and resubscribe. Switching your active gateway only affects new subscribers — it does not disrupt anyone already subscribed. This is by design to avoid interrupting active billing mandates.',
//       },
//       {
//         question: "Why did a subscriber's payment fail?",
//         answer:
//           'Payment failures are usually caused by insufficient funds, an expired card, or a UPI mandate limit being reached. Substrack automatically sends a payment failure email to the subscriber and starts the dunning process — it will retry and send reminders over the following days. You can track affected subscribers under the "Past Due" status on your Subscribers page.',
//       },
//       {
//         question: 'Does Substrack charge a transaction fee?',
//         answer:
//           'No. Substrack does not charge any transaction fee or percentage of your revenue. You only pay your Substrack plan fee. Your payment gateway (Stripe or Cashfree) charges their own standard processing fees directly — Substrack has no involvement in that.',
//       },
//     ],
//   },
//   {
//     title: 'Integration & Technical',
//     items: [
//       {
//         question: 'How do I add a subscription button to my website?',
//         answer:
//           'You have three options depending on your setup. The simplest is to copy the payment link from your Plans page and link it from any button on your site. For deeper integration, use the JavaScript SDK (Settings → Integrations → SDK) to gate content for active subscribers. For developers, the REST API lets you build fully custom subscription flows with server-side verification.',
//       },
//       {
//         question: 'Can I use Substrack with WordPress?',
//         answer:
//           'Yes. Download the Substrack WordPress plugin from Settings → Integrations → WordPress Plugin. Install it on your WordPress site and use shortcodes to gate content for active subscribers or add subscribe buttons to any page. No coding required.',
//       },
//       {
//         question: 'What is the REST API used for?',
//         answer:
//           'The REST API is for merchants who have their own backend server and want to verify subscription status programmatically — for example, before serving a protected API endpoint or gating access to a mobile app. Generate an API key from Settings → Integrations → REST API and use it server-side only. Never use your API key in client-side code.',
//       },
//       {
//         question: 'Can I use Substrack without a website?',
//         answer:
//           'Yes. You can share your plan payment links directly — via WhatsApp, email, Instagram bio, or any messaging app. Your customers click the link and subscribe without you needing a website at all. A website is only required if you want to gate content or embed a subscribe button into your own pages.',
//       },
//     ],
//   },
// ]

// const QUICK_LINKS = [
//   {
//     label: 'Payment Setup',
//     description: 'Connect Stripe or Cashfree to start accepting payments',
//     href: '/settings',
//     icon: Settings,
//     color: 'bg-blue-100 text-blue-600',
//   },
//   {
//     label: 'Subscribers',
//     description: 'View and manage your active subscriber base',
//     href: '/subscribers',
//     icon: Users,
//     color: 'bg-green-100 text-green-600',
//   },
//   {
//     label: 'Integration Guides',
//     description: 'SDK, REST API, and WordPress plugin setup',
//     href: '/settings',
//     icon: Puzzle,
//     color: 'bg-purple-100 text-purple-600',
//   },
// ]

// export default function ContactPage() {
//   const [copied, setCopied] = useState(false)
//   const [openFaq, setOpenFaq] = useState<string | null>(null)

//   const handleCopyEmail = (): void => {
//     navigator.clipboard.writeText(SUPPORT_EMAIL)
//     setCopied(true)
//     setTimeout(() => setCopied(false), 2000)
//   }

//   const toggleFaq = (key: string): void => {
//     setOpenFaq((prev) => (prev === key ? null : key))
//   }

//   return (
//     <div className='max-w-4xl mx-auto'>

//       {/* Header */}
//       <div className='text-center mb-8'>
//         <h2 className='text-2xl font-bold text-gray-800 mb-2'>Help & Support</h2>
//         <p className='text-gray-500'>
//           Find answers to common questions or reach us directly — we respond within 24 hours.
//         </p>
//       </div>

//       {/* Email CTA */}
//       <div className='bg-white rounded-xl shadow-sm p-8 mb-6 text-center'>
//         <div className='w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
//           <Mail className='w-7 h-7 text-blue-600' />
//         </div>
//         <h3 className='text-lg font-semibold text-gray-800 mb-1'>Email Support</h3>
//         <p className='text-sm text-gray-500 mb-4'>
//           For account issues, billing questions, or anything not covered below
//         </p>
//         <a
//           href={`mailto:${SUPPORT_EMAIL}`}
//           className='text-blue-600 font-medium text-sm hover:underline block mb-4'
//         >
//           {SUPPORT_EMAIL}
//         </a>
//         <div className='flex items-center justify-center gap-3'>
//           <a
//             href={`mailto:${SUPPORT_EMAIL}`}
//             className='inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
//           >
//             <Mail className='w-4 h-4' />
//             Send Email
//           </a>
//           <button
//             onClick={handleCopyEmail}
//             className='inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors'
//           >
//             {copied ? (
//               <>
//                 <Check className='w-4 h-4 text-green-600' />
//                 Copied
//               </>
//             ) : (
//               <>
//                 <Copy className='w-4 h-4' />
//                 Copy Address
//               </>
//             )}
//           </button>
//         </div>
//       </div>

//       {/* Quick Links */}
//       <div className='grid md:grid-cols-3 gap-4 mb-6'>
//         {QUICK_LINKS.map((link) => {
//           const Icon = link.icon
//           return (
//             <Link
//               key={link.label}
//               href={link.href}
//               className='bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow group'
//             >
//               <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${link.color}`}>
//                 <Icon className='w-5 h-5' />
//               </div>
//               <div className='flex-1 min-w-0'>
//                 <div className='flex items-center justify-between gap-2'>
//                   <h4 className='text-sm font-semibold text-gray-800'>{link.label}</h4>
//                   <ArrowRight className='w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors' />
//                 </div>
//                 <p className='text-xs text-gray-500 mt-0.5 leading-relaxed'>{link.description}</p>
//               </div>
//             </Link>
//           )
//         })}
//       </div>

//       {/* FAQ */}
//       <div className='bg-white rounded-xl shadow-sm p-8 mb-6'>
//         <h3 className='text-lg font-semibold text-gray-800 mb-6'>Frequently Asked Questions</h3>

//         <div className='space-y-8'>
//           {FAQ_GROUPS.map((group, gi) => (
//             <div key={group.title}>
//               <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3'>
//                 {group.title}
//               </p>
//               <div className='divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden'>
//                 {group.items.map((item, ii) => {
//                   const key = `${gi}-${ii}`
//                   const isOpen = openFaq === key
//                   return (
//                     <div key={key}>
//                       <button
//                         onClick={() => toggleFaq(key)}
//                         className='w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors'
//                         aria-expanded={isOpen}
//                       >
//                         <span className='text-sm font-medium text-gray-800 pr-4'>
//                           {item.question}
//                         </span>
//                         <ChevronDown
//                           className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
//                             isOpen ? 'rotate-180' : ''
//                           }`}
//                         />
//                       </button>
//                       {isOpen && (
//                         <div className='px-5 pb-4 text-sm text-gray-600 leading-relaxed bg-gray-50'>
//                           {item.answer}
//                         </div>
//                       )}
//                     </div>
//                   )
//                 })}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* Bottom CTA */}
//       <div className='bg-blue-50 border border-blue-100 rounded-xl p-6 text-center'>
//         <h3 className='text-sm font-semibold text-gray-800 mb-1'>Still need help?</h3>
//         <p className='text-sm text-gray-500 mb-4'>
//           If your question is not answered above, email us and we will get back to you within 24 hours.
//         </p>
//         <a
//           href={`mailto:${SUPPORT_EMAIL}`}
//           className='inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
//         >
//           <Mail className='w-4 h-4' />
//           Email Support
//         </a>
//       </div>

//     </div>
//   )
// }

// app/(dashboard)/contact/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Copy,
  Check,
  ChevronDown,
  Settings,
  Users,
  Puzzle,
  FileText,
} from 'lucide-react'

const SUPPORT_EMAIL = 'support@substrack-yags.vercel.app'

interface FaqItem {
  question: string
  answer: string
}

interface FaqGroup {
  label: string
  items: FaqItem[]
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    label: 'Getting started',
    items: [
      {
        question: 'How do I connect my payment gateway?',
        answer:
          'Go to Settings → Payment Setup. Configure Stripe for international payments or Cashfree for Indian UPI. Save your credentials, then click "Set as Active Gateway". You can configure both and switch between them at any time.',
      },
      {
        question: 'What is the difference between Stripe and Cashfree?',
        answer:
          'Use Cashfree for Indian subscribers — it supports UPI Autopay, the most common recurring payment method in India. Use Stripe for international subscribers or card-first payments. You can configure both gateways and switch between them as your business grows.',
      },
      {
        question: 'How do customers subscribe to my plans?',
        answer:
          'Create a plan, copy the payment link, and share it anywhere — your website, WhatsApp, email, or Instagram bio. Customers click the link, fill in their details, and pay. The subscription is created automatically and appears in your Subscribers list.',
      },
    ],
  },
  {
    label: 'Payments & billing',
    items: [
      {
        question: 'What happens to existing subscribers if I switch payment gateways?',
        answer:
          'Existing subscribers stay on the gateway they originally subscribed through until they cancel and resubscribe. Switching your active gateway only affects new subscribers — it does not disrupt anyone already subscribed. This avoids interrupting active billing mandates.',
      },
      {
        question: "Why did a subscriber's payment fail?",
        answer:
          'Usually insufficient funds, an expired card, or a UPI mandate limit being reached. Substrack automatically emails the subscriber and starts the dunning process. Track affected subscribers under the "Past Due" status on your Subscribers page.',
      },
      {
        question: 'Does Substrack charge a transaction fee?',
        answer:
          'No. Substrack does not take any percentage of your revenue. Your payment gateway (Stripe or Cashfree) charges their own processing fees directly — Substrack has no involvement in that.',
      },
    ],
  },
  {
    label: 'Integration & technical',
    items: [
      {
        question: 'How do I add a subscribe button to my website?',
        answer:
          'Three options depending on your setup. Simplest: copy the payment link from Plans and link it from any button. For content gating: use the JavaScript SDK (Settings → Integrations → SDK) to show or hide content based on subscription status. For developers: the REST API lets you verify subscriptions server-side.',
      },
      {
        question: 'Can I use Substrack with WordPress?',
        answer:
          'Yes. Download the Substrack WordPress plugin from Settings → Integrations → WordPress Plugin. Install it and use shortcodes to gate content for active subscribers or add subscribe buttons to any page. No coding required.',
      },
      {
        question: 'Can I use Substrack without a website?',
        answer:
          'Yes. Share your plan payment links directly via WhatsApp, email, Instagram bio, or any messaging app. Your customers click the link and subscribe without you needing a website at all. A website is only needed if you want to gate content or embed a subscribe button.',
      },
    ],
  },
]

const QUICK_LINKS = [
  {
    label: 'Payment Setup',
    description: 'Connect Stripe or Cashfree',
    href: '/settings?tab=stripe',
    icon: Settings,
    iconBg: '#EBF4FF',
    iconColor: '#185FA5',
  },
  {
    label: 'Subscribers',
    description: 'View your subscriber base',
    href: '/subscribers',
    icon: Users,
    iconBg: '#EAF3DE',
    iconColor: '#3B6D11',
  },
  {
    label: 'Integrations',
    description: 'SDK, API, WordPress',
    href: '/settings?tab=integrations',
    icon: Puzzle,
    iconBg: '#EEEDFE',
    iconColor: '#534AB7',
  },
  {
    label: 'Plans',
    description: 'Manage your offerings',
    href: '/plans',
    icon: FileText,
    iconBg: '#FAEEDA',
    iconColor: '#854F0B',
  },
]

export default function ContactPage() {
  const [copied, setCopied] = useState(false)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const handleCopyEmail = (): void => {
    navigator.clipboard.writeText(SUPPORT_EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleFaq = (key: string): void => {
    setOpenFaq((prev) => (prev === key ? null : key))
  }

  return (
    <div>
      <div className='mb-5'>
        <h2 className='text-xl font-semibold text-gray-800 mb-1'>Help & Support</h2>
        <p className='text-sm text-gray-500'>
          Find answers to common questions or reach us directly.
        </p>
      </div>

      {/* Top row: email card + quick links */}
      <div className='grid md:grid-cols-2 gap-4 mb-4'>

        {/* Email card */}
        <div className='bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4'>
          <div>
            <p className='text-sm font-semibold text-gray-800 mb-1'>Email support</p>
            <p className='text-sm text-gray-500'>
              For billing, account issues, or anything not answered below.
            </p>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className='text-sm font-medium text-blue-600 hover:underline break-all'
          >
            {SUPPORT_EMAIL}
          </a>
          <div className='flex items-center gap-2 flex-wrap'>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className='inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
            >
              <Mail className='w-4 h-4' />
              Send email
            </a>
            <button
              onClick={handleCopyEmail}
              className='inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors'
            >
              {copied ? (
                <>
                  <Check className='w-4 h-4 text-green-600' />
                  Copied
                </>
              ) : (
                <>
                  <Copy className='w-4 h-4' />
                  Copy address
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick links 2x2 grid */}
        <div className='grid grid-cols-2 gap-3'>
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.label}
                href={link.href}
                className='bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:border-gray-300 hover:shadow-sm transition-all'
              >
                <div
                  className='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0'
                  style={{ backgroundColor: link.iconBg }}
                >
                  <Icon className='w-4 h-4' style={{ color: link.iconColor }} />
                </div>
                <div>
                  <p className='text-sm font-medium text-gray-800'>{link.label}</p>
                  <p className='text-xs text-gray-400 mt-0.5'>{link.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className='bg-white rounded-xl border border-gray-200 p-6'>
        <p className='text-sm font-semibold text-gray-800 mb-5'>
          Frequently asked questions
        </p>

        <div className='space-y-6'>
          {FAQ_GROUPS.map((group, gi) => (
            <div key={group.label}>
              <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'>
                {group.label}
              </p>
              <div className='divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden'>
                {group.items.map((item, ii) => {
                  const key = `${gi}-${ii}`
                  const isOpen = openFaq === key
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggleFaq(key)}
                        className='w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors'
                        aria-expanded={isOpen}
                      >
                        <span className='text-sm font-medium text-gray-800 pr-4'>
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className='px-4 pb-4 pt-0.5 text-sm text-gray-600 leading-relaxed bg-gray-50'>
                          {item.answer}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className='mt-6 pt-5 border-t border-gray-100 flex items-center justify-between'>
          <p className='text-sm text-gray-500'>Still have a question?</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className='inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
          >
            <Mail className='w-4 h-4' />
            Email support
          </a>
        </div>
      </div>
    </div>
  )
}