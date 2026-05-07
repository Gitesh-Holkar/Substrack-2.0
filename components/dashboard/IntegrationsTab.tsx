'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { ApiKeysTab } from '@/components/dashboard/ApiKeysTab'
import {
  Copy,
  Check,
  RefreshCw,
  Download,
  Code2,
  Server,
  Puzzle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'

type SubPanel = 'sdk' | 'api' | 'wordpress'

interface SubOption {
  id: SubPanel
  label: string
  icon: React.ReactNode
  badge: string
  badgeColor: string
  tagline: string
}

const SUB_OPTIONS: SubOption[] = [
  {
    id: 'sdk',
    label: 'Frontend SDK',
    icon: <Code2 className="w-5 h-5" />,
    badge: 'Testing only',
    badgeColor: 'bg-amber-100 text-amber-700',
    tagline: 'Quick setup for prototypes. Not recommended for production.',
  },
  {
    id: 'api',
    label: 'REST API',
    icon: <Server className="w-5 h-5" />,
    badge: 'Production ready',
    badgeColor: 'bg-green-100 text-green-700',
    tagline: 'Server-side key auth. Secure for any production app.',
  },
  {
    id: 'wordpress',
    label: 'WordPress Plugin',
    icon: <Puzzle className="w-5 h-5" />,
    badge: 'Production ready',
    badgeColor: 'bg-green-100 text-green-700',
    tagline: 'Server-side PHP plugin. Key never reaches the browser.',
  },
]

export function IntegrationsTab() {
  const [activePanel, setActivePanel] = useState<SubPanel>('sdk')

  useEffect(() => {
    const handleSwitchPanel = (event: Event) => {
      const customEvent = event as CustomEvent<SubPanel>
      if (customEvent.detail === 'sdk' || customEvent.detail === 'api' || customEvent.detail === 'wordpress') {
        setActivePanel(customEvent.detail)
      }
    }

    window.addEventListener('substrack:switch-panel', handleSwitchPanel)

    return () => {
      window.removeEventListener('substrack:switch-panel', handleSwitchPanel)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SUB_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setActivePanel(opt.id)}
            className={`rounded-lg border-2 p-4 text-left transition-all ${
              activePanel === opt.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={activePanel === opt.id ? 'text-blue-600' : 'text-gray-500'}>
                {opt.icon}
              </span>
              <span
                className={`text-sm font-semibold ${
                  activePanel === opt.id ? 'text-blue-800' : 'text-gray-700'
                }`}
              >
                {opt.label}
              </span>
            </div>
            <span
              className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${opt.badgeColor}`}
            >
              {opt.badge}
            </span>
            <p className="text-xs leading-snug text-gray-500">{opt.tagline}</p>
          </button>
        ))}
      </div>

      {activePanel === 'sdk' && <SdkPanel />}
      {activePanel === 'api' && <ApiPanel />}
      {activePanel === 'wordpress' && <WordPressPanel />}
    </div>
  )
}

function SdkPanel() {
  const { user } = useAuth()
  const [sdkCodeCopied, setSdkCodeCopied] = useState(false)

  const sdkUrl = 'https://substrack-yags.vercel.app/substrack-sdk.js'

  const sdkCode = useMemo(() => {
    const merchantId = user?.id || 'YOUR_MERCHANT_ID'
    return `<!-- Step 1: Add SDK Script -->
<script src="${sdkUrl}"></script>

<script>
  // Step 2: Initialize SDK with YOUR Merchant ID
  const substrack = new Substrack();
  substrack.init('${merchantId}');

  // Step 3: Check Subscription After User Login
  async function checkUserSubscription() {
    const userEmail = getCurrentUserEmail(); // Replace with your method
    const hasSubscription = await substrack.checkSubscription(userEmail);
    
    if (hasSubscription) {
      console.log('Plan:', substrack.getPlan());
      document.getElementById('premium-content').style.display = 'block';
      document.getElementById('subscribe-btn').style.display = 'none';
    } else {
      document.getElementById('premium-content').style.display = 'none';
      document.getElementById('subscribe-btn').style.display = 'block';
    }
  }

  // Call after user login
  checkUserSubscription();
</script>`
  }, [user?.id, sdkUrl])

  const copyCode = useCallback((): void => {
    navigator.clipboard.writeText(sdkCode).then(() => {
      setSdkCodeCopied(true)
      setTimeout(() => setSdkCodeCopied(false), 2000)
    })
  }, [sdkCode])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Not recommended for production</p>
          <p className="mt-0.5 text-sm text-amber-700">
            The SDK checks subscriptions by email only — there is no token verification. Any user
            who knows another user's email could potentially spoof access. Use the{' '}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('substrack:switch-panel', {
                    detail: 'api',
                  })
                )
              }}
            >
              REST API
            </button>{' '}
            for production apps.
          </p>
        </div>
      </div>

      <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="mb-1 text-sm font-semibold text-blue-900">Your Merchant ID</p>
            <p className="mb-3 text-xs text-blue-700">
              Use this to initialise the SDK. It identifies your account — it is safe to include
              in frontend code.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all rounded-md border border-blue-300 bg-white px-3 py-2 font-mono text-sm text-blue-900">
                {user?.id}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(user?.id || '')
                }}
                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Integration Code</h4>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            {sdkCodeCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Code
              </>
            )}
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Paste into your website. Works with any authentication system — Firebase, Auth0,
          Supabase Auth, or custom.
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
            <code>{sdkCode}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

function ApiPanel() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">Recommended for production</p>
          <p className="mt-0.5 text-sm text-green-700">
            Your API key lives on your server only — it never reaches the browser. Requests are
            authenticated by SHA-256 hashed key lookup, scoped to your merchant account.
          </p>
        </div>
      </div>

      <ApiKeysTab />
    </div>
  )
}

function WordPressPanel() {
  const [copiedShortcode, setCopiedShortcode] = useState<string | null>(null)

  const copyShortcode = (text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedShortcode(text)
      setTimeout(() => setCopiedShortcode(null), 2000)
    })
  }

  const shortcodes = [
    {
      code: '[substrack_gated plan_id="YOUR-PLAN-UUID"]Your members-only content here[/substrack_gated]',
      label: 'Gate content',
      description:
        'Shows inner content to active subscribers only. Non-subscribers see a fallback message you configure in the plugin settings.',
    },
    {
      code: '[substrack_subscribe_button plan_id="YOUR-PLAN-UUID" text="Subscribe Now"]',
      label: 'Subscribe button',
      description:
        'A link to the Substrack checkout page for a specific plan. Use one CSS class name in the class attribute (WordPress limitation).',
    },
    {
      code: '[substrack_plans]',
      label: 'Plans listing',
      description:
        'Renders all your active plans as cards with pricing and features. Active subscribers see a "Current Plan" badge instead of a button.',
    },
    {
      code: '[substrack_status]',
      label: 'Status badge',
      description:
        `Inline text showing the logged-in user's subscription status and plan name. Use in headers or account pages.`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">Server-side — production ready</p>
          <p className="mt-0.5 text-sm text-green-700">
            The plugin makes all API calls from PHP on your WordPress server. Your Substrack API
            key is stored in the WordPress database and never sent to the browser.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="mb-1 text-sm font-semibold text-gray-800">Download Plugin</h4>
        <p className="mb-4 text-xs text-gray-500">Requires WordPress 6.0+ and PHP 8.0+.</p>
        <a
          href="/downloads/substrack-wp.zip"
          download="substrack-wp.zip"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          Download substrack-wp.zip
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h4 className="text-sm font-semibold text-gray-700">Installation</h4>
        </div>
        <div className="p-5">
          <ol className="space-y-3 text-sm text-gray-600">
            {[
              'Download the ZIP above.',
              'In WordPress Admin go to Plugins → Add New → Upload Plugin, choose the ZIP, and click Install Now.',
              'Click Activate Plugin.',
              'Go to Settings → Substrack in your WordPress Admin.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h4 className="text-sm font-semibold text-gray-700">Configuration (do this once)</h4>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-1 font-semibold text-gray-700">App URL</p>
              <p className="mb-2 text-xs text-gray-500">
                The Substrack platform URL. This is the same for every merchant — it is not unique
                to your account.
              </p>
              <code className="block break-all rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs">
                https://substrack-yags.vercel.app
              </code>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-1 font-semibold text-gray-700">API Key</p>
              <p className="mb-2 text-xs text-gray-500">
                Create one in the <strong>REST API tab</strong> on this same page, then paste it
                here.
              </p>
              <code className="block rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs">
                sub_live_…
              </code>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-1 text-sm font-semibold text-amber-800">⚠ Email matching requirement</p>
            <p className="text-sm text-amber-700">
              The plugin checks subscriptions using the WordPress user's email. For gating to work,
              the customer's WordPress account email must match the email they used when
              subscribing through Substrack.
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="mb-1 text-sm font-semibold text-blue-800">Cache & real-time updates</p>
            <p className="text-sm text-blue-700">
              Subscription status is cached for 5 minutes by default. If you cancel a subscriber in
              Substrack and want WordPress to reflect it immediately, click{' '}
              <strong>Clear Subscription Cache</strong> in the WordPress plugin settings (Settings
              → Substrack → Clear Cache button).
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h4 className="text-sm font-semibold text-gray-700">Finding your Plan IDs</h4>
        </div>
        <div className="space-y-2 p-5 text-sm text-gray-600">
          <p>Every shortcode that targets a plan needs its UUID.</p>
          <ol className="list-inside list-decimal space-y-1.5">
            <li>
              Go to <strong>Plans</strong> in the Substrack dashboard.
            </li>
            <li>
              Click <strong>Copy Payment Link</strong> on the plan.
            </li>
            <li>
              The link is{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">
                https://substrack-yags.vercel.app/subscribe/YOUR-UUID
              </code>
              . The UUID after{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">/subscribe/</code> is your plan
              ID.
            </li>
          </ol>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h4 className="text-sm font-semibold text-gray-700">Shortcode Reference</h4>
        </div>
        <div className="divide-y divide-gray-100">
          {shortcodes.map((sc) => (
            <div key={sc.label} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-semibold text-gray-700">{sc.label}</p>
                  <p className="mb-2 text-xs text-gray-500">{sc.description}</p>
                  <code className="block break-all rounded bg-gray-100 px-3 py-2 font-mono text-xs leading-relaxed text-gray-800">
                    {sc.code}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyShortcode(sc.code)}
                  className="mt-6 flex flex-shrink-0 items-center gap-1.5 rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  {copiedShortcode === sc.code ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
