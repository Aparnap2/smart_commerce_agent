'use client'

import React, { type FC } from 'react'
import type { DisputeCardProps } from '@/lib/ui-event-types'
import { safeString } from '@/lib/genui/safe-render'

const DisputeCard: FC<DisputeCardProps> = ({ prId, reason }) => {
  return (
    <div data-testid="dispute-card" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">🚨</span>
        <h3 className="font-semibold text-gray-900">Dispute Request</h3>
      </div>
      
      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1">PR ID</div>
        <div className="font-medium text-gray-900">{safeString(prId)}</div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-1">Reason</div>
        <div className="text-gray-700">{safeString(reason)}</div>
      </div>
      
      <button 
        data-testid="raise-dispute-btn"
        className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
      >
        Raise Dispute
      </button>
    </div>
  )
}

export default DisputeCard