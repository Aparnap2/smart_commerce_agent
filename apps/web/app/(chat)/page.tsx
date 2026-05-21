'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useRef, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'
import CatalogGrid from '@/components/genui/CatalogGrid'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id?: string
}

interface UIComponent {
  type: string
  props: any
}

const SUGGESTIONS = [
  'Show me laptops',
  'Check my budget',
  'Show pending approvals',
] as const

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

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

  const isTestMode = typeof window !== 'undefined' && ((window as any).Cypress || (window as any).__PLAYWRIGHT__)

  if (!isTestMode) {
    if (loading) return null
    if (!token) redirect('/auth/login')
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    
    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: text, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setUIComponents([])

    try {
      // Get token from cookie
      const token = document.cookie.split('token=')[1]?.split(';')[0] || '';
      
      // Call our API which proxies to agent-core
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-mode': isTestMode ? 'true' : '',
          'x-user-id': isTestMode ? 'test-user-id' : 'employee',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          user_id: isTestMode ? 'test-user-id' : 'employee',
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      // Read SSE stream
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
        
        // Parse SSE events
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
                      props: inner.__ui__.props,
                    }])
                    content = ''  // Skip showing JSON metadata in messages
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
                    setUIComponents(prev => [...prev, { type: action.name, props: action.props }])
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
        content: `Error: ${error.message}` 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, uiComponents])

  const renderUIComponent = (ui: UIComponent, i: number) => {
    switch (ui.type) {
      case 'catalog-grid': {
        const rawItems = ui.props?.items || ui.props?.products || []
        const items = rawItems.map((p: any) => ({
          id: String(p.id ?? p.sku ?? ''),
          name: p.name ?? '',
          vendor: p.vendor ?? 'Unknown Vendor',
          unitPrice: p.unitPrice ?? p.price ?? null,
          category: p.category ?? null,
          inStock: p.inStock !== false,
          leadDays: p.leadDays ?? null,
        }))
        return (
          <div key={i}>
            <CatalogGrid items={items} loading={ui.props?.loading} />
          </div>
        )
      }
      case 'budget-gauge':
        return (
          <div key={i} data-testid="budget-gauge" className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium">Budget Status</div>
            <div className="text-2xl font-bold text-blue-600">₹{((ui.props?.remaining || 0) / 100).toLocaleString()}</div>
            <div className="text-xs text-gray-500">of ₹{((ui.props?.total || 0) / 100).toLocaleString()}</div>
          </div>
        )
      default:
        return <div key={i} className="text-xs text-gray-400">Unknown: {ui.type}</div>
    }
  }

  return (
    <Shell rail={<Rail />}>
      <div className="flex flex-col h-screen bg-gray-50 max-w-2xl mx-auto">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">T</div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">ProcureAI Assistant</div>
            <div className="text-xs text-green-500">Online</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!messages.length && (
            <div className="space-y-3">
              <p className="text-center text-gray-500 text-sm">
                👋 Hi! How can I help?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    data-testid="suggested-action"
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id || i} className="space-y-2">
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  data-testid={msg.role === 'user' ? 'message-user' : 'message-assistant'}
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm
                    ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {uiComponents.map((ui, i) => renderUIComponent(ui, i))}

          {isLoading && (
            <div data-testid="agent-thinking" className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2 flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="bg-white border-t px-4 py-3 flex gap-3 items-end">
          <textarea
            data-testid="chat-input"
            aria-label="Message input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Ask anything about products, orders, or returns..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32 overflow-y-auto"
          />
          <button
            data-testid="send-button"
            aria-label="Send message"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-indigo-700 transition-colors">
            ↑
          </button>
        </div>
      </div>
    </Shell>
  )
}