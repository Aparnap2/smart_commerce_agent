'use client'

import React, { useEffect, useState } from 'react'
import type { FC } from 'react'
import type { BudgetGaugeProps } from '@/lib/ui-event-types'

const BudgetGauge: FC<BudgetGaugeProps> = ({ department, monthlyBudget, spent, remaining, percentUsed }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0)
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(percentUsed), 100)
    return () => clearTimeout(timer)
  }, [percentUsed])

  const gaugeColor = percentUsed < 70 ? 'bg-green-500' : percentUsed < 90 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div data-testid="budget-gauge" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-900">{department} Budget</span>
        <span className="text-sm text-gray-500">{percentUsed}% used</span>
      </div>
      
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full ${gaugeColor} transition-all duration-500 ease-out`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Spent: <span className="font-medium">₹{spent.toLocaleString('en-IN')}</span></span>
        <span className="text-gray-600">Budget: <span className="font-medium">₹{monthlyBudget.toLocaleString('en-IN')}</span></span>
      </div>
      
      <div className="text-center mt-2 text-sm">
        Remaining: <span className="font-semibold text-indigo-600">₹{remaining.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

export default BudgetGauge