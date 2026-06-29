'use client'

import React, { useState } from 'react'
import { safeArray, safeString } from '@/lib/genui/safe-render'
import type { ReplyDraftProps } from '@/lib/ui-event-types'

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading draft reply"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-20 bg-gray-100 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 bg-gray-200 rounded-lg w-24" />
          <div className="h-8 bg-gray-200 rounded-lg w-20" />
          <div className="h-8 bg-gray-200 rounded-lg w-16" />
        </div>
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <p className="text-gray-700 font-medium text-sm">Failed to load draft</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function ReplyDraftCard(props: ReplyDraftProps) {
  const draft = safeString(props?.draft)
  const caseId = safeString(props?.caseId)
  const tone = safeString(props?.tone, 'neutral')
  const contextUsed = safeArray<string>(props?.contextUsed)

  const [editMode, setEditMode] = useState(false)
  const [editedDraft, setEditedDraft] = useState(draft)
  const [copied, setCopied] = useState(false)

  if (!draft) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium text-sm">No draft reply available</p>
        <p className="text-gray-400 text-xs mt-1">Ask the agent to generate a draft reply</p>
      </div>
    )
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editMode ? editedDraft : draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available
    }
  }

  const toneColor =
    tone === 'formal' ? 'bg-indigo-100 text-indigo-700' :
    tone === 'empathetic' ? 'bg-pink-100 text-pink-700' :
    tone === 'technical' ? 'bg-cyan-100 text-cyan-700' :
    'bg-gray-100 text-gray-700' // neutral fallback

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Draft Reply
        </h3>
        <div className="flex items-center gap-2">
          {caseId && <span className="text-xs text-gray-400 font-mono">#{caseId}</span>}
          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${toneColor}`}>
            {tone}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Draft text */}
        {editMode ? (
          <textarea
            value={editedDraft}
            onChange={(e) => setEditedDraft(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y min-h-[120px] leading-relaxed"
            aria-label="Edit draft reply"
            rows={6}
          />
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{editMode ? editedDraft : draft}</pre>
          </div>
        )}

        {/* Context used */}
        {contextUsed.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Context Used
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {contextUsed.map((ctx, i) => (
                <span
                  key={i}
                  className="inline-flex px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600 font-medium"
                >
                  {ctx}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => {
              setEditMode(!editMode)
              if (editMode) {
                // When leaving edit mode without saving, reset
                setEditedDraft(draft)
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {editMode ? 'Cancel' : 'Edit'}
          </button>
          {editMode && (
            <button
              onClick={() => setEditMode(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          )}
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white/70 cursor-not-allowed ml-auto"
            title="Send is not yet available"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
