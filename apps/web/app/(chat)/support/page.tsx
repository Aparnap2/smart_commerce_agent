'use client'

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'
import { UIContextProvider, useUIContext } from '@/components/support/UIContext'
import ContextPanel from '@/components/support/ContextPanel'
import { Send, Headset, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
export const dynamic = 'force-dynamic'

import dynamicLoader from 'next/dynamic'

const CaseListCard = dynamicLoader(() => import('@/components/genui/support/CaseListCard'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />,
})

const CaseDetailCard = dynamicLoader(() => import('@/components/genui/support/CaseDetailCard'), {
  loading: () => <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />,
})

const CustomerContextCard = dynamicLoader(() => import('@/components/genui/support/CustomerContextCard'), {
  loading: () => <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />,
})

const KBResultsCard = dynamicLoader(() => import('@/components/genui/support/KBResultsCard'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />,
})

const SimilarTicketsCard = dynamicLoader(() => import('@/components/genui/support/SimilarTicketsCard'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />,
})

const ReplyDraftCard = dynamicLoader(() => import('@/components/genui/support/ReplyDraftCard'), {
  loading: () => <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />,
})

const CaseCreatedCard = dynamicLoader(() => import('@/components/genui/support/CaseCreatedCard'), {
  loading: () => <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />,
})

const CaseUpdatedCard = dynamicLoader(() => import('@/components/genui/support/CaseUpdatedCard'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />,
})

const EscalationCard = dynamicLoader(() => import('@/components/genui/support/EscalationCard'), {
  loading: () => <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionInfo {
  userId: string
  role: string
  name?: string
  sfOrg?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id?: string
}

interface UIComponent {
  type: string
  props: Record<string, unknown>
}

type PageState = 'loading' | 'error' | 'ready'

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <Shell rail={<Rail />}>
      <div className="flex-1 flex flex-col h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-40" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
            <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-24 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Shell rail={<Rail />}>
      <div className="flex-1 flex flex-col h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Headset size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">SupportPilot</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900">Failed to load workspace</p>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
            <button
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'Find cases for customer Acme Corp',
  'Show case 00001001',
  "What's the customer context for Contact #123?",
  'Search KB for login issues',
] as const

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-sm border border-emerald-200">
          <Headset size={36} className="text-emerald-600" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center shadow-sm border-2 border-white">
          <Sparkles size={14} className="text-white" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome to SupportPilot</h2>
      <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        Your AI-powered Salesforce support cockpit. Ask me anything about cases, customers, knowledge articles, or draft replies.
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="text-xs px-3.5 py-2 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 font-medium"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GenUI Component Renderer
// ---------------------------------------------------------------------------

function renderSupportUIComponent(ui: UIComponent, index: number) {
  const cardClasses = 'w-full'

  switch (ui.type) {
    case 'case-list':
    case 'caseList':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-xl" />}>
            <CaseListCard
              cases={(ui.props?.cases ?? []) as any}
              query={(ui.props?.query as string) ?? ''}
              totalCount={(ui.props?.totalCount as number) ?? 0}
            />
          </Suspense>
        </div>
      )

    case 'case-detail':
    case 'caseDetail':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-48 bg-gray-100 rounded-xl" />}>
            <CaseDetailCard case={ui.props?.case as any} />
          </Suspense>
        </div>
      )

    case 'customer-context':
    case 'customerContext':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 rounded-xl" />}>
            <CustomerContextCard
              account={ui.props?.account as any}
              contact={ui.props?.contact as any}
              openCases={(ui.props?.openCases ?? []) as any}
              recentInteractions={(ui.props?.recentInteractions ?? []) as any}
            />
          </Suspense>
        </div>
      )

    case 'kb-results':
    case 'kbResults':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-xl" />}>
            <KBResultsCard
              articles={(ui.props?.articles ?? []) as any}
              query={(ui.props?.query as string) ?? ''}
              totalCount={(ui.props?.totalCount as number) ?? 0}
            />
          </Suspense>
        </div>
      )

    case 'similar-tickets':
    case 'similarTickets':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-xl" />}>
            <SimilarTicketsCard
              tickets={(ui.props?.tickets ?? []) as any}
              query={(ui.props?.query as string) ?? ''}
              totalCount={(ui.props?.totalCount as number) ?? 0}
            />
          </Suspense>
        </div>
      )

    case 'reply-draft':
    case 'replyDraft':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-40 bg-gray-100 rounded-xl" />}>
            <ReplyDraftCard
              draft={(ui.props?.draft as string) ?? ''}
              caseId={(ui.props?.caseId as string) ?? ''}
              tone={(ui.props?.tone as string) ?? 'neutral'}
              contextUsed={(ui.props?.contextUsed as string[]) ?? []}
            />
          </Suspense>
        </div>
      )

    case 'case-created':
    case 'caseCreated':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-24 bg-gray-100 rounded-xl" />}>
            <CaseCreatedCard case={ui.props?.case as any} />
          </Suspense>
        </div>
      )

    case 'case-updated':
    case 'caseUpdated':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-xl" />}>
            <CaseUpdatedCard
              case={ui.props?.case as any}
              changes={(ui.props?.changes as string[]) ?? []}
            />
          </Suspense>
        </div>
      )

    case 'escalation-card':
    case 'escalationCard':
      return (
        <div key={`ui-${index}`} className={cardClasses}>
          <Suspense fallback={<div className="animate-pulse h-40 bg-gray-100 rounded-xl" />}>
            <EscalationCard
              escalation={ui.props?.escalation as any}
              requiresApproval={Boolean(ui.props?.requiresApproval)}
            />
          </Suspense>
        </div>
      )

    default:
      return (
        <div key={`ui-${index}`} className="text-xs text-gray-400 italic px-2 py-1 bg-gray-50 rounded-lg border border-gray-200">
          Unknown component: {ui.type}
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Support Workspace Page — Outer Shell
// ---------------------------------------------------------------------------

export default function SupportWorkspacePage() {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      setPageState('loading')
      const res = await fetch('/api/agent/session')
      if (!res.ok) throw new Error('Failed to load session')
      const data = await res.json()
      setSession(data)
      setPageState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPageState('error')
    }
  }

  if (pageState === 'loading') {
    return <PageSkeleton />
  }

  if (pageState === 'error') {
    return <ErrorState message={error ?? 'Unknown error'} onRetry={fetchSession} />
  }

  return (
    <Shell rail={<Rail />}>
      <UIContextProvider>
        <SupportWorkspace session={session!} />
      </UIContextProvider>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// Support Workspace — Chat + Context Panel
// ---------------------------------------------------------------------------

function SupportWorkspace({ session }: { session: SessionInfo }) {
  const { addUIPayload, setStreaming, clearContext } = useUIContext()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [uiComponents, setUIComponents] = useState<UIComponent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastFailedText, setLastFailedText] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Expose for E2E testing (guarded against SSR)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__addUIPayload = addUIPayload
      ;(window as any).__clearContext = clearContext
      return () => {
        delete (window as any).__addUIPayload
        delete (window as any).__clearContext
      }
    }
  }, [addUIPayload, clearContext])

  /**
   * Reset the 30-second inactivity timeout for the SSE stream.
   * If no new data arrives within the window, the connection is aborted.
   */
  function resetStreamTimeout(controller: AbortController) {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
    streamTimeoutRef.current = setTimeout(() => {
      controller.abort()
      setStreamError('Response timed out after 30s of inactivity. Please try again.')
    }, 30_000)
  }

  // ── Send Message ─────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setUIComponents([])
    setStreamError(null)
    setLastFailedText(null)
    setStreaming(true)
    clearContext()

    const controller = new AbortController()

    try {
      const tokenFromCookie = typeof document !== 'undefined'
        ? document.cookie.split('token=')[1]?.split(';')[0] || ''
        : ''

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': session?.role || 'SUPPORT_AGENT',
          'x-user-id': session?.userId || 'support-agent',
          Authorization: tokenFromCookie ? `Bearer ${tokenFromCookie}` : '',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          user_id: session?.userId || 'support-agent',
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(errText ? `API error: ${response.status} — ${errText}` : `API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''

      // Start the inactivity timeout
      resetStreamTimeout(controller)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Reset inactivity timeout on every data chunk
        resetStreamTimeout(controller)

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6)

            // Handle empty data — skip
            if (!raw.trim()) continue

            try {
              const parsed = JSON.parse(raw)

              // ── messages/partial — AI text chunks (canonical) ──
              if (eventType === 'messages/partial') {
                const msgs = Array.isArray(parsed) ? parsed : [parsed]
                for (const msg of msgs) {
                  const content = msg.content || ''
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
                continue
              }

              // ── custom event — GenUI __ui__ payloads (canonical) ──
              if (eventType === 'custom') {
                if (parsed?.type === 'ui' && parsed?.name) {
                  const name = parsed.name as string
                  const props = (parsed.props ?? {}) as Record<string, unknown>
                  setUIComponents(prev => [...prev, { type: name, props }])
                  addUIPayload(name, props)
                }
                continue
              }

              // ── end event — stream complete (canonical) ──
              if (eventType === 'end') {
                setIsLoading(false)
                setStreaming(false)
                if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
                continue
              }

              // ── error event from backend ──
              if (eventType === 'error') {
                const errorMsg = parsed?.message || 'An unknown stream error occurred'
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Error: ${errorMsg}`,
                }])
                setIsLoading(false)
                setStreaming(false)
                if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
                continue
              }

              // ═══════════════════════════════════════════════════════
              // Backward-compatible event types (legacy chat.py format)
              // ═══════════════════════════════════════════════════════

              // ── delta — legacy AI text chunks ──
              if (eventType === 'delta') {
                const content = parsed.content || ''
                if (content) {
                  setMessages(prev => {
                    const last = prev[prev.length - 1]
                    if (last?.role === 'assistant') {
                      return [...prev.slice(0, -1), { ...last, content: last.content + content }]
                    }
                    return [...prev, { role: 'assistant', content }]
                  })
                }
                continue
              }

              // ── ui_actions — legacy GenUI payload ──
              if (eventType === 'ui_actions') {
                const actions = parsed.actions || []
                for (const action of actions) {
                  if (action?.name) {
                    const name = action.name as string
                    const props = (action.props ?? {}) as Record<string, unknown>
                    setUIComponents(prev => [...prev, { type: name, props }])
                    addUIPayload(name, props)
                  }
                }
                continue
              }

              // ── complete — legacy stream complete ──
              if (eventType === 'complete') {
                setIsLoading(false)
                setStreaming(false)
                if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
                continue
              }
            } catch {
              // JSON parse error — skip malformed data (SSE parse errors
              // don't crash the page per req #4)
            }
          }
        }
      }
    } catch (err: unknown) {
      // AbortError from user abort or timeout — handled gracefully
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLastFailedText(text)
        return
      }

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setStreamError(errorMessage)
      setLastFailedText(text)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Connection lost: ${errorMessage}`,
      }])
    } finally {
      setIsLoading(false)
      setStreaming(false)
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
    }
  }

  // ── Handle Enter key ─────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Retry last failed message ────────────────────────────────────────
  const retryLastMessage = useCallback(() => {
    if (lastFailedText) {
      setStreamError(null)
      sendMessage(lastFailedText)
    }
  }, [lastFailedText])

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, uiComponents])

  // ── Ready state — the full support workspace with GenUI rendering ────
  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Center Panel — Chat ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
                <Headset size={18} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-gray-900">SupportPilot</h1>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded">BETA</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-500">
                    Welcome, {session?.name || 'Support Agent'}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                    {session?.role || 'SUPPORT_AGENT'}
                  </span>
                  {session?.sfOrg && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                      {session.sfOrg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages and GenUI components area ────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Empty state */}
            {messages.length === 0 && uiComponents.length === 0 && !isLoading && (
              <EmptyState onSend={sendMessage} />
            )}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mr-2.5 mt-1 shadow-sm">
                    <Headset size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 text-sm break-words leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-md shadow-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-2xl rounded-tl-md shadow-sm'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* GenUI components */}
            {uiComponents.map((ui, i) => renderSupportUIComponent(ui, i))}

            {/* Inline error with retry (connection failure or timeout) */}
            {streamError && lastFailedText && !isLoading && (
              <div className="flex justify-center">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 max-w-md">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span className="flex-1">{streamError}</span>
                  <button
                    onClick={retryLastMessage}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 rounded-lg transition-colors shrink-0"
                  >
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading indicator — animated pulse skeleton */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mr-2.5 mt-1 shadow-sm">
                  <Headset size={14} className="text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm px-5 py-4">
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="text-xs text-gray-400 ml-1 font-medium">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input area ────────────────────────────────────────────── */}
        <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              aria-label="Message input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about cases, customers, or draft replies..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 max-h-32 overflow-y-auto bg-gray-50 hover:bg-white transition-colors placeholder:text-gray-400"
              disabled={isLoading}
            />
            <button
              aria-label="Send message"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 active:bg-emerald-800 transition-all duration-200 shrink-0 shadow-sm"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Context ──────────────────────────────────────── */}
      <ContextPanel />
    </div>
  )
}
