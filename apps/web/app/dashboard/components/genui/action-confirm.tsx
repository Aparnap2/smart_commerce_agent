'use client'
import React from 'react'

interface ConfirmAction {
  stepId: string
  step:   string
  tool:   string
  type:   string
  args?:  Record<string, unknown>
}

interface Props {
  actions:    ConfirmAction[]
  onDecision: (stepId: string, approved: boolean) => void
}

export function ActionConfirm({ actions, onDecision }: Props) {
  if (!actions.length) return null

  return (
    <div data-testid="action-confirm" className="space-y-3">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
        Confirm Actions
      </p>
      {actions.map((action, idx) => (
        <div
          key={action.stepId ?? idx}
          className="border border-amber-200 rounded-xl p-4 bg-amber-50"
        >
          <div className="flex items-start gap-2 mb-3">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div>
              <p className="font-medium text-sm">{action.step}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Tool: {action.tool}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              data-testid={`approve-${action.stepId ?? idx}`}
              onClick={() => onDecision(action.stepId ?? String(idx), true)}
              className="flex-1 bg-black text-white py-2 rounded-lg text-sm
                         font-medium hover:bg-gray-800 transition-colors"
            >
              Approve
            </button>
            <button
              data-testid={`cancel-${action.stepId ?? idx}`}
              onClick={() => onDecision(action.stepId ?? String(idx), false)}
              className="flex-1 border border-gray-200 py-2 rounded-lg text-sm
                         font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
