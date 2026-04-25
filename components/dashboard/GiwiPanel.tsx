'use client'

// components/dashboard/GiwiPanel.tsx
//
// GIWI AI assistant panel — floating button + slide-in panel.
// Rendered via React Portal to document.body to avoid z-index conflicts.
// Uses custom events to receive metric context from dashboard page.
// All GIWI state is self-contained in this component.

import { useState, useEffect, useRef, useCallback } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { X, Send, Sparkles, RefreshCw, Activity } from 'lucide-react'
import type { GiwiMessage, GiwiInsights } from '@/lib/types'

const DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes
const SESSION_KEY = 'giwi_conversation'

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function getPageLabel(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'Dashboard'
  if (pathname.includes('/plans')) return 'Plans'
  if (pathname.includes('/subscribers')) return 'Subscribers'
  if (pathname.includes('/payments')) return 'Payments'
  if (pathname.includes('/settings')) return 'Settings'
  return 'Dashboard'
}

interface GiwiOpenEvent {
  metric?: string
  explanation?: string
  chips?: [string, string, string]
}

export function GiwiPanel(): JSX.Element | null {
  const pathname = usePathname()
  const { merchant } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<GiwiMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastContextRefresh, setLastContextRefresh] = useState<number>(0)
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null)
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null)
  const [showUsage, setShowUsage] = useState(false)
  const [insights, setInsights] = useState<GiwiInsights | null>(null)
  const [profileChecked, setProfileChecked] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef<GiwiMessage[]>([])

  useEffect(() => {
    conversationRef.current = messages
  }, [messages])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as GiwiMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {
      // sessionStorage unavailable — start fresh
    }
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-20)))
    } catch {
      // Ignore quota errors
    }
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const refreshContext = useCallback(async (): Promise<boolean> => {
    const now = Date.now()
    if (now - lastContextRefresh < DEBOUNCE_MS) return true

    try {
      const res = await fetch('/api/ai/context', { method: 'POST' })
      if (res.ok) {
        setLastContextRefresh(now)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [lastContextRefresh])

  const loadInsights = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/insights', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { data?: GiwiInsights }
        if (data.data) setInsights(data.data)
      }
    } catch {
      // Non-critical
    }
  }, [])

  const checkAndShowOnboarding = useCallback(async (): Promise<boolean> => {
    // Returns true if onboarding message was shown (profile not set up)
    // Returns false if profile is ready (normal flow should proceed)
    if (profileChecked) return false // already checked this session

    try {
      const res = await fetch('/api/ai/profile')
      if (res.ok) {
        const data = await res.json() as {
          data?: { onboarding_completed?: boolean; business_description?: string } | null
        }
        const ready = !!(data.data?.onboarding_completed && data.data?.business_description)
        setProfileChecked(true)

        if (!ready && messages.length === 0) {
          const onboardingMessage: GiwiMessage = {
            id: generateId(),
            role: 'giwi',
            content: `Hello! I'm GIWI, your AI business assistant. To give you personalised insights about your subscription business, I need to know a bit about what you do.\n\nPlease go to Settings → AI Assistant and fill in your business profile. It takes about a minute and makes all my analysis much more relevant to your specific business.`,
            chips: ['What can GIWI help with?', 'Why do you need this?', 'Remind me later'],
            timestamp: new Date().toISOString(),
          }
          setMessages([onboardingMessage])
          return true
        }
      }
    } catch {
      // Non-critical — proceed normally if check fails
    }
    return false
  }, [profileChecked, messages.length])

  const openPanel = useCallback(async (detail?: GiwiOpenEvent): Promise<void> => {
    setIsOpen(true)

    const ready = await refreshContext()
    if (!ready) return

    if (!insights) {
      await loadInsights()
    }

    // Check if business profile is set up — show onboarding message if not
    // Only check if there are no existing messages (fresh session)
    if (messages.length === 0) {
      const onboardingShown = await checkAndShowOnboarding()
      if (onboardingShown) return
    }

    if (detail?.metric && detail.explanation) {
      const chips = detail.chips ?? [
        `What is ${detail.metric}?`,
        'How does this compare to healthy range?',
        'How do I improve this?',
      ] as [string, string, string]

      const greeting: GiwiMessage = {
        id: generateId(),
        role: 'giwi',
        content: detail.explanation,
        chips,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].content === detail.explanation) return prev
        return [...prev, greeting]
      })
      return
    }

    if (messages.length === 0) {
      const businessName = merchant?.business_name ?? 'your business'
      const greeting: GiwiMessage = {
        id: generateId(),
        role: 'giwi',
        content: `Hello! I'm GIWI, your business intelligence assistant. I've loaded your latest ${businessName} data. What would you like to know?`,
        chips: ['Show me my key metrics', 'How is my churn rate?', 'Help me improve my MRR'],
        timestamp: new Date().toISOString(),
      }
      setMessages([greeting])
    }
  }, [refreshContext, loadInsights, insights, messages.length, merchant?.business_name, checkAndShowOnboarding])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<GiwiOpenEvent>).detail
      void openPanel(detail)
    }
    window.addEventListener('giwi:open', handler)
    return () => window.removeEventListener('giwi:open', handler)
  }, [openPanel])

  const closePanel = useCallback(async (): Promise<void> => {
    setIsOpen(false)

    const conversation = conversationRef.current
    if (conversation.length < 2) return

    const rawConversation = conversation.map((message) => ({
      role: message.role,
      content: message.rawContent ?? message.content,
    }))

    try {
      await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawConversation }),
      })
    } catch {
      // Non-critical
    }
  }, [])

  const sendMessage = useCallback(async (messageText: string): Promise<void> => {
    // Special case: onboarding "Remind me later" chip closes the panel
    if (messageText === 'Remind me later') {
      closePanel()
      return
    }

    const trimmed = messageText.trim()
    if (!trimmed || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMessage: GiwiMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    const historyForApi = updatedMessages.slice(-11, -1).map((message) => ({
      role: message.role,
      content: message.rawContent ?? message.content,
    }))

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: historyForApi,
          currentPage: getPageLabel(pathname),
        }),
      })

      let responseText: string
      let rawResponseText: string

      // Read rate limit headers before consuming body
      const remainingHeader = res.headers.get('X-RateLimit-Remaining')
      const resetHeader = res.headers.get('X-RateLimit-Reset')
      if (remainingHeader !== null) {
        setRateLimitRemaining(parseInt(remainingHeader, 10))
      }
      if (resetHeader !== null) {
        setRateLimitReset(parseInt(resetHeader, 10))
      }

      if (res.ok) {
        const data = await res.json() as { message?: string; rawMessage?: string }
        responseText = data.message ?? 'I was unable to generate a response. Please try again.'
        rawResponseText = data.rawMessage ?? responseText
      } else if (res.status === 429) {
        const errData = await res.json() as { error?: string; remaining?: number; reset?: number }
        if (errData.error === 'daily_limit_reached') {
          if (errData.remaining !== undefined) setRateLimitRemaining(errData.remaining)
          if (errData.reset !== undefined) setRateLimitReset(errData.reset)
          responseText = 'You have reached your daily message limit. Check the usage indicator to see when it resets.'
        } else {
          responseText = 'Please wait a moment before sending another message.'
        }
        rawResponseText = responseText
      } else {
        responseText = "I'm having trouble connecting right now. Please try again in a moment."
        rawResponseText = responseText
      }

      const giwiMessage: GiwiMessage = {
        id: generateId(),
        role: 'giwi',
        content: responseText,
        rawContent: rawResponseText,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, giwiMessage])
    } catch {
      const errorMessage: GiwiMessage = {
        id: generateId(),
        role: 'giwi',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [closePanel, isLoading, messages, pathname])

  const handleChipClick = useCallback((chipText: string): void => {
    void sendMessage(chipText)
  }, [sendMessage])

  const clearConversation = useCallback((): void => {
    setMessages([])
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  if (!mounted) return null

  const pageLabel = getPageLabel(pathname)

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        aria-label="Open GIWI AI Assistant"
        className={`fixed bottom-6 right-6 z-[9000] flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isOpen ? 'hidden' : 'flex'}`}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[9001]"
          onClick={() => void closePanel()}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-[9002] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="GIWI AI Assistant"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">GIWI</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                  <span className="text-xs text-gray-500">AI Assistant</span>
                </span>
              </div>
              <p className="text-xs text-gray-400">Viewing: {pageLabel}</p>
            </div>
          </div>
        <div className="flex items-center gap-2">
          {/* Usage button — only shown after first message is sent */}
          {rateLimitRemaining !== null && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUsage((prev) => !prev)}
                title="View daily usage"
                className={`p-1.5 rounded-md transition-colors ${
                  rateLimitRemaining === 0
                    ? 'text-red-500 hover:bg-red-50'
                    : rateLimitRemaining <= 10
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Activity className="w-4 h-4" />
              </button>

              {showUsage && (
                <div className="absolute right-0 top-9 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-10">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Daily usage</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>{100 - rateLimitRemaining} used</span>
                    <span>100 messages</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        rateLimitRemaining === 0
                          ? 'bg-red-500'
                          : rateLimitRemaining <= 10
                            ? 'bg-amber-400'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(((100 - rateLimitRemaining) / 100) * 100, 100)}%` }}
                    />
                  </div>
                  {rateLimitReset !== null && (
                    <p className="text-xs text-gray-400 mt-2">
                      {rateLimitRemaining === 0
                        ? `Resets in ${Math.ceil((rateLimitReset - Date.now()) / (1000 * 60 * 60))} hours`
                        : `${rateLimitRemaining} messages remaining`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={clearConversation}
              title="Clear conversation"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void closePanel()}
              aria-label="Close GIWI"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
              <Sparkles className="w-10 h-10 mb-3 text-blue-200" />
              <p className="text-sm font-medium text-gray-500">GIWI is ready</p>
              <p className="text-xs text-gray-400 mt-1">Ask anything about your business</p>
            </div>
          )}

          {messages.map((message) => {
            const lines = message.content.split('\n')

            return (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}
                >
                  {lines.map((line, index) => (
                    <span key={index}>
                      {line}
                      {index < lines.length - 1 && <br />}
                    </span>
                  ))}
                </div>

                {message.role === 'giwi' && message.chips && (
                  <div className="flex flex-wrap gap-2 mt-2 max-w-[85%]">
                    {message.chips.map((chip, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {isLoading && (
            <div className="flex items-start">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-1 flex-shrink-0">
          {rateLimitRemaining !== null && rateLimitRemaining <= 10 && (
            <div className={`mb-2 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full w-fit mx-auto ${
              rateLimitRemaining === 0
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-600'
            }`}>
              <Activity className="w-3 h-3" />
              {rateLimitRemaining === 0
                ? 'Daily message limit reached'
                : `${rateLimitRemaining} messages remaining today`}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            GIWI provides intelligent guidance based on your data — not guaranteed outcomes.
          </p>
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask GIWI anything about your business..."
              rows={1}
              disabled={isLoading || rateLimitRemaining === 0}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-24 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={isLoading || !input.trim() || rateLimitRemaining === 0}
              aria-label="Send message"
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
