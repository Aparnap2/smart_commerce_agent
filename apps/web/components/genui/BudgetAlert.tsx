'use client'

import React, { type FC } from 'react'
import type { BudgetAlertProps } from '@/lib/ui-event-types'

const BudgetAlert: FC<BudgetAlertProps> = ({ itemName, requested, remaining }) => {
  const handleRequestIncrease = () => {
    console.log('Requesting budget increase for:', itemName)
  }

  return (
    <div data-testid="budget-alert" className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-amber-800">
            Adding "{itemName}" would exceed your department budget.
          </div>
          <div className="text-sm text-amber-700 mt-1">
            Requested: ₹{requested.toLocaleString('en-IN')} • Remaining: ₹{remaining.toLocaleString('en-IN')}
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