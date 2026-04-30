'use client'

import React, { type FC } from 'react'
import type { PRSubmittedProps } from '@/lib/ui-event-types'

const PRSubmittedCard: FC<PRSubmittedProps> = ({ prNumber, approverEmail, totalAmount }) => {
  return (
    <div data-testid="pr-submitted" className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">✅</span>
        <h3 className="font-semibold text-green-800">PR Submitted Successfully</h3>
      </div>
      
      <div className="text-sm text-green-700 space-y-1">
        <p><span className="font-medium">PR Number:</span> {prNumber}</p>
        <p><span className="font-medium">Sent to:</span> {approverEmail}</p>
        <p><span className="font-medium">Total Amount:</span> ₹{totalAmount.toLocaleString('en-IN')}</p>
      </div>
      
      <p className="text-sm text-green-600 mt-3">
        Your manager has been notified. You'll receive updates via email.
      </p>
    </div>
  )
}

export default PRSubmittedCard