'use client'

import React, { type FC } from 'react'
import type { BudgetAlertProps } from '@/lib/ui-event-types'
import { safeString, safeNumber, formatIndian } from '@/lib/genui/safe-render'

const BudgetAlert: FC<BudgetAlertProps> = ({ itemName, requested, remaining }) => {
  const handleRequestIncrease = () => {
    console.log('Requesting budget increase for:', itemName)
  }

  const safeItemName = safeString(itemName, 'this item')
  const safeRequested = safeNumber(requested, 0)
  const safeRemaining = safeNumber(remaining, 0)

  return (
    <div data-testid="budget-alert" className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-amber-800">
            Adding &ldquo;{safeItemName}&rdquo; would exceed your department budget.
          </div>
          <div className="text-sm text-amber-700 mt-1">
            Requested: ₹{formatIndian(safeRequested)} &bull; Remaining: ₹{formatIndian(safeRemaining)}
          </div>
          <button
            data-testid="request-increase-btn"
            onClick={handleRequestIncrease}
            className="mt-3 bg-amber-500 text-white text-sm py-2 px-4 rounded-lg font-medium hover:bg-amber-600 transition-colors"
          >
            Request budget increase
          </button>
        </div>
      </div>
    </div>
  )
}

export default BudgetAlert