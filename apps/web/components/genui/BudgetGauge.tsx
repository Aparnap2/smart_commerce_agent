'use client'

import React, { useEffect, useState } from 'react'
import type { FC } from 'react'

interface Props {
  department?: string
  spent?: number
  total?: number
  remaining?: number
  percentUsed?: number
}

const BudgetGauge: FC<Props> = ({ department, spent = 0, total = 0, remaining = 0, percentUsed = 0 }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0)
  
  const safePercent = percentUsed ?? 0
  const safeSpent = spent ?? 0
  const safeTotal = total ?? 0
  const safeRemaining = remaining ?? (safeTotal - safeSpent)
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(Math.min(Math.max(safePercent, 0), 100)), 100)
    return () => clearTimeout(timer)
  }, [safePercent])

  const gaugeColor = safePercent < 70 ? 'bg-green-500' : safePercent < 90 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div data-testid="budget-gauge" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-900">{department ?? 'Department'} Budget</span>
        <span className="text-sm text-gray-500">{safePercent.toFixed(1)}% used</span>
      </div>
      
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full ${gaugeColor} transition-all duration-500 ease-out`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Spent: <span className="font-medium">₹{safeSpent.toLocaleString('en-IN')}</span></span>
        <span className="text-gray-600">Budget: <span className="font-medium">₹{safeTotal.toLocaleString('en-IN')}</span></span>
      </div>
      
      <div className="text-center mt-2 text-sm">
        Remaining: <span className="font-semibold text-indigo-600">₹{safeRemaining.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

export default BudgetGauge