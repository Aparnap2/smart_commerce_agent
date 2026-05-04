'use client'

import { useStream } from '@langchain/langgraph-sdk/react'
import { Client } from '@langchain/langgraph-sdk'
import { useRef, useEffect, useState } from 'react'
import { Message } from '@/components/genui/Message'
import { AgentThinking } from '@/components/genui/AgentThinking'

const MERCHANT_CHIPS = [
  "Today's revenue",
  "What's running low?",
  'Recent refund requests',
  'Show abandoned carts',
] as const

export default function MerchantChatPage() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const client = new Client({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_URL ?? 'http://localhost:2024',
  })

  const { values, submit, isLoading, error } = useStream<any>({
    client,
    assistantId: 'merchant',
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [values?.messages, isLoading])

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return
    submit({ messages: [{ type: 'human', content: text }] })
    setInput('')
  }

  const messages = values?.messages ?? []

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <h1 className="text-sm font-semibold text-zinc-100">ProcureAI Operations</h1>
        <span className="text-xs text-zinc-500">Merchant Dashboard</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-zinc-100">Operations Dashboard</h2>
              <p className="text-sm text-zinc-400 max-w-sm">Revenue, inventory, orders — all in one place.</p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-md justify-center">
              {MERCHANT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors"
                  data-testid="merchant-chip"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg: any) => (
              <div key={msg.id}>
                {msg.type === 'human' && (
                  <Message role="user" content={msg.content} />
                )}
                {(msg.type === 'ai' || msg.type === 'assistant') && msg.content && (
                  <Message role="assistant" content={msg.content} />
                )}
              </div>
            ))}
            {isLoading && <AgentThinking toolName="Analyzing..." />}
            {error && <Message role="assistant" content={`Error: ${(error as Error).message}`} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 max-w-3xl mx-auto">
          {MERCHANT_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
              data-testid="merchant-chip"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            placeholder="Ask about revenue, inventory, orders..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (input.trim()) {
                  handleSend(input)
                }
              }
            }}
            disabled={isLoading}
            className="flex-1 rounded-xl px-4 py-2.5 bg-zinc-800 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-purple-500 disabled:opacity-50 text-sm"
            aria-label="Merchant message input"
          />
        </div>
      </div>
    </div>
  )
}
