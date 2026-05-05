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

  const getColor = () => {
    if (safePercent >= 90) return { bg: 'bg-red-500', text: 'text-red-600', label: 'Critical' }
    if (safePercent >= 70) return { bg: 'bg-amber-500', text: 'text-amber-600', label: 'Warning' }
    return { bg: 'bg-emerald-500', text: 'text-emerald-600', label: 'Healthy' }
  }

  const color = getColor()

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{department ?? 'Department'}</h3>
          <p className="text-sm text-gray-500">Monthly Budget</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${color.bg} text-white`}>
          {color.label}
        </div>
      </div>

      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div 
          className={`absolute left-0 top-0 h-full ${color.bg} transition-all duration-700 ease-out rounded-full`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Spent</p>
          <p className="text-lg font-bold text-gray-900">₹{safeSpent.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Budget</p>
          <p className="text-lg font-bold text-gray-900">₹{safeTotal.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
          <p className={`text-lg font-bold ${safeRemaining < 0 ? 'text-red-600' : color.text}`}>
            ₹{safeRemaining.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 text-center">
        <span className="text-sm text-gray-500">
          {safePercent.toFixed(1)}% of budget used
        </span>
      </div>
    </div>
  )
}

export default BudgetGauge