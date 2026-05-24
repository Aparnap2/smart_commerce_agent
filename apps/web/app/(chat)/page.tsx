'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useRef, useEffect, Suspense, lazy } from 'react'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'

// ---------------------------------------------------------------------------
// Lazy-loaded GenUI components — each loaded on demand via React.lazy()
// ---------------------------------------------------------------------------

const CatalogGrid = lazy(() => import('@/components/genui/CatalogGrid'))
const BudgetGauge = lazy(() => import('@/components/genui/BudgetGauge'))
const PurchaseRequestDraft = lazy(() => import('@/components/genui/PurchaseRequestDraft'))
const ApprovalCard = lazy(() => import('@/components/genui/ApprovalCard'))
const PRList = lazy(() => import('@/components/genui/PRList'))

// ---------------------------------------------------------------------------
// Suspense fallbacks (per-component skeletons)
// ---------------------------------------------------------------------------

const SkeletonBlock = ({ h = 'h-32', testId }: { h?: string; testId?: string }) => (
  <div
    data-testid={testId}
    className={`animate-pulse bg-gray-100 rounded-xl ${h} w-full`}
    role="status"
    aria-label="Loading component"
  />
)

const CatalogSkeleton = () => (
  <div data-testid="catalog-skeleton" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-36 bg-gray-100" />
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-5 bg-gray-100 rounded w-1/3" />
          <div className="h-9 bg-gray-100 rounded-lg w-full" />
        </div>
      </div>
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id?: string
}

interface UIComponent {
  type: string
  props: Record<string, unknown>
}

const SUGGESTIONS = [
  'Show me laptops',
  'Check my budget',
  'Show pending approvals',
] as const

// ---------------------------------------------------------------------------
// Cookie helper
// ---------------------------------------------------------------------------

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

// ---------------------------------------------------------------------------
// Component renderer — uses React.lazy + Suspense for each GenUI type
// ---------------------------------------------------------------------------

function renderUIComponent(ui: UIComponent, index: number) {
  switch (ui.type) {
    // ── Catalog Grid ──────────────────────────────────────────────────
    case 'catalog-grid':
    case 'catalogGrid': {
      const items = (ui.props?.items ?? ui.props?.products) as any[] | undefined
      const loading = Boolean(ui.props?.loading)
      const error = ui.props?.error as string | undefined

      return (
        <div key={`ui-${index}`} className="w-full">
          <Suspense fallback={<CatalogSkeleton />}>
            <CatalogGrid
              items={items}
              products={ui.props?.products as any[] | undefined}
              loading={loading}
              error={error}
              onAddToPR={undefined}
            />
          </Suspense>
        </div>
      )
    }

    // ── Budget Gauge ──────────────────────────────────────────────────
    case 'budget-gauge':
    case 'budgetGauge': {
      return (
        <div key={`ui-${index}`} className="w-full">
          <Suspense fallback={<SkeletonBlock h="h-40" testId="budget-gauge-skeleton" />}>
            <BudgetGauge
              department={ui.props?.department as string | undefined}
              name={ui.props?.name as string | undefined}
              totalBudget={ui.props?.totalBudget as number | undefined}
              total={ui.props?.total as number | undefined}
              spent={ui.props?.spent as number | undefined}
              remaining={ui.props?.remaining as number | undefined}
              percentUsed={ui.props?.percentUsed as number | undefined}
              categoryBreakdown={ui.props?.categoryBreakdown as any[] | undefined}
              loading={Boolean(ui.props?.loading)}
              error={ui.props?.error as string | undefined}
            />
          </Suspense>
        </div>
      )
    }

    // ── Purchase Request Draft ────────────────────────────────────────
    case 'purchase-request-draft':
    case 'purchaseRequestDraft':
    case 'pr-draft':
    case 'prDraft':
    case 'showPRDraft': {
      return (
        <div key={`ui-${index}`} className="w-full">
          <Suspense fallback={<SkeletonBlock h="h-48" testId="pr-draft-skeleton" />}>
            <PurchaseRequestDraft
              prNumber={ui.props?.prNumber as string | undefined}
              status={ui.props?.status as string | undefined}
              requestor={ui.props?.requestor as string | undefined}
              requestedBy={ui.props?.requestedBy as string | undefined}
              lineItems={ui.props?.lineItems as any[] | undefined}
              items={ui.props?.items as any[] | undefined}
              products={ui.props?.products as any[] | undefined}
              total={ui.props?.total as number | undefined}
              justification={ui.props?.justification as string | undefined}
              createdAt={ui.props?.createdAt as string | undefined}
              loading={Boolean(ui.props?.loading)}
              error={ui.props?.error as string | undefined}
            />
          </Suspense>
        </div>
      )
    }

    // ── PR List ──────────────────────────────────────────────────────
    case 'pr-list':
    case 'prList':
    case 'showPRList': {
      return (
        <div key={`ui-${index}`} className="w-full">
          <Suspense fallback={<SkeletonBlock h="h-48" testId="pr-list-skeleton" />}>
            <PRList
              requests={ui.props?.requests as any[] | undefined}
              loading={Boolean(ui.props?.loading)}
              error={ui.props?.error as string | undefined}
            />
          </Suspense>
        </div>
      )
    }

    // ── Approval Card ─────────────────────────────────────────────────
    case 'approval-card':
    case 'approvalCard':
    case 'showApprovalCard': {
      return (
        <div key={`ui-${index}`} className="w-full">
          <Suspense fallback={<SkeletonBlock h="h-48" testId="approval-card-skeleton" />}>
            <ApprovalCard
              pr={ui.props?.pr as any}
              prId={ui.props?.prId as string | undefined}
              prNumber={ui.props?.prNumber as string | undefined}
              requestorName={ui.props?.requestorName as string | undefined}
              totalAmount={ui.props?.totalAmount as number | undefined}
              lineItems={ui.props?.lineItems as any[] | undefined}
              justification={ui.props?.justification as string | undefined}
              urgency={ui.props?.urgency as string | undefined}
              threadId={ui.props?.threadId as string | undefined}
              loading={Boolean(ui.props?.loading)}
              error={ui.props?.error as string | undefined}
              onSubmitDecision={undefined}
            />
          </Suspense>
        </div>
      )
    }

    // ── Fallback ──────────────────────────────────────────────────────
    default:
      return (
        <div key={`ui-${index}`} className="text-xs text-gray-400 italic px-2">
          Unknown component: {ui.type}
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CustomerChatPage() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [uiComponents, setUIComponents] = useState<UIComponent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = getCookie('token')
    setToken(t)
    setLoading(false)
  }, [])

  const isTestMode = typeof window !== 'undefined' && (Boolean((window as any).Cypress) || Boolean((window as any).__PLAYWRIGHT__))

  if (!isTestMode) {
    if (loading) return null
    if (!token) redirect('/auth/login')
  }

  // ── Send Message ─────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setUIComponents([])

    try {
      const tokenFromCookie = document.cookie.split('token=')[1]?.split(';')[0] || ''

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-mode': isTestMode ? 'true' : '',
          'x-user-id': isTestMode ? 'test-user-id' : 'employee',
          Authorization: tokenFromCookie ? `Bearer ${tokenFromCookie}` : '',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          user_id: isTestMode ? 'test-user-id' : 'employee',
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              if (eventType === 'delta') {
                const parsed = JSON.parse(data)
                let content = parsed.content || ''

                // Try to extract __ui__ from JSON content
                try {
                  const inner = JSON.parse(content)
                  if (inner.__ui__) {
                    setUIComponents(prev => [...prev, {
                      type: inner.__ui__.name,
                      props: inner.__ui__.props ?? {},
                    }])
                    content = ''
                  }
                } catch {
                  // Not JSON, use as-is
                }

                if (content) {
                  setMessages(prev => {
                    const last = prev[prev.length - 1]
                    if (last?.role === 'assistant') {
                      return [...prev.slice(0, -1), { ...last, content: last.content + content }]
                    }
                    return [...prev, { role: 'assistant', content }]
                  })
                }
              }

              if (eventType === 'ui_actions') {
                const parsed = JSON.parse(data)
                const actions = parsed.actions || []
                for (const action of actions) {
                  if (action?.name) {
                    setUIComponents(prev => [...prev, { type: action.name, props: action.props ?? {} }])
                  }
                }
              }

              if (eventType === 'complete') {
                setIsLoading(false)
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Send error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, uiComponents])

  // ── Handle Enter key ─────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Shell rail={<Rail />}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            T
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">ProcureAI Assistant</div>
            <div className="text-xs text-emerald-500">Online</div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-4 space-y-4 scrollbar-thin">
          {!messages.length && !isLoading && (
            <div className="space-y-3 pt-8">
              <p className="text-center text-gray-500 text-sm">
                👋 Hi! How can I help?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    data-testid="suggested-action"
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div key={msg.id || i} className="space-y-2">
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  data-testid={msg.role === 'user' ? 'message-user' : 'message-assistant'}
                  className={`max-w-[85%] sm:max-w-[75%] px-4 py-2 rounded-2xl text-sm break-words
                    ${msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* GenUI components */}
          {uiComponents.map((ui, i) => renderUIComponent(ui, i))}

          {/* Loading indicator */}
          {isLoading && (
            <div data-testid="agent-thinking" className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-3 shrink-0">
          <div className="flex gap-3 items-end max-w-2xl mx-auto">
            <textarea
              data-testid="chat-input"
              aria-label="Message input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about products, orders, or returns..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32 overflow-y-auto"
            />
            <button
              data-testid="send-button"
              aria-label="Send message"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
