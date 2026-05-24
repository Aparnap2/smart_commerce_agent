'use client'

import React, { useEffect, useState } from 'react'
import type { FC } from 'react'
import {
  safeString,
  safePrice,
  safePercent,
  safeArray,
  safeNumber,
  formatIndian,
} from '@/lib/genui/safe-render'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryBreakdown {
  name: string
  budget: number
  spent: number
}

export interface BudgetGaugeProps {
  /** Department/team name */
  department?: string
  /** Alias for department */
  name?: string
  /** Total budget in paise */
  totalBudget?: number
  /** Alias for totalBudget */
  total?: number
  /** Amount spent in paise */
  spent?: number
  /** Remaining budget in paise */
  remaining?: number
  /** Pre-calculated percentage used (0-100) */
  percentUsed?: number
  /** Category-level breakdown */
  categoryBreakdown?: CategoryBreakdown[]
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BudgetLevel = 'healthy' | 'warning' | 'critical'

const getBudgetLevel = (pct: number): BudgetLevel => {
  if (pct >= 80) return 'critical'
  if (pct >= 50) return 'warning'
  return 'healthy'
}

const levelConfig: Record<BudgetLevel, { bg: string; text: string; label: string; bar: string }> = {
  healthy:  { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Healthy',  bar: 'bg-emerald-500' },
  warning:  { bg: 'bg-amber-500',  text: 'text-amber-700',  label: 'Warning',  bar: 'bg-amber-500' },
  critical: { bg: 'bg-red-500',    text: 'text-red-700',    label: 'Critical', bar: 'bg-red-500' },
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div data-testid="budget-gauge-skeleton" className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse" role="status" aria-label="Loading budget">
    <div className="flex justify-between mb-6">
      <div className="space-y-2">
        <div className="h-5 bg-gray-100 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
      <div className="h-6 bg-gray-100 rounded-full w-16" />
    </div>
    <div className="h-4 bg-gray-100 rounded-full mb-4" />
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-1 text-center">
          <div className="h-3 bg-gray-100 rounded w-12 mx-auto" />
          <div className="h-6 bg-gray-100 rounded w-20 mx-auto" />
        </div>
      ))}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState = () => (
  <div data-testid="budget-gauge-empty" className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p className="text-gray-500 font-medium text-sm">No budget data</p>
    <p className="text-gray-400 text-xs mt-1">Budget information is not available</p>
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div data-testid="budget-gauge-error" className="bg-white rounded-xl border border-red-200 shadow-sm p-6 text-center">
    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
      </svg>
    </div>
    <p className="text-gray-700 font-medium text-sm">Budget data unavailable</p>
    <p className="text-gray-400 text-xs mt-1">{message}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Category Breakdown Sub-component
// ---------------------------------------------------------------------------

const CategoryBar: FC<{ name: string; budget: number; spent: number; maxBudget: number }> = ({
  name,
  budget,
  spent,
  maxBudget,
}) => {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  const level = getBudgetLevel(pct)
  const cfg = levelConfig[level]

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 truncate mr-2">{safeString(name)}</span>
        <span className="text-gray-500 font-medium whitespace-nowrap">
          {safePrice(spent)} / {safePrice(budget)}
        </span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BudgetGauge: FC<BudgetGaugeProps> = ({
  department,
  name,
  totalBudget,
  total,
  spent: spentProp,
  remaining: remainingProp,
  percentUsed: percentUsedProp,
  categoryBreakdown,
  loading,
  error,
}) => {
  // Derive values with safe defaults
  const safeDept = safeString(department || name, 'Department')
  const spent = safeNumber(spentProp, 0)
  const budgetTotal = safeNumber(totalBudget ?? total, 0)
  const calcPercent = budgetTotal > 0 ? (spent / budgetTotal) * 100 : 0
  const percentUsedLocal = safePercent(percentUsedProp ?? calcPercent)
  const remaining = safeNumber(remainingProp, budgetTotal - spent)

  // Animated bar width
  const [animatedWidth, setAnimatedWidth] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(percentUsedLocal), 100)
    return () => clearTimeout(timer)
  }, [percentUsedLocal])

  const level = getBudgetLevel(percentUsedLocal)
  const cfg = levelConfig[level]

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ───────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Empty (no budget data) ──────────────────────────────────────────
  if (budgetTotal <= 0 && spent <= 0) return <EmptyState />

  // ── Parse category breakdown ────────────────────────────────────────
  const categories = safeArray<CategoryBreakdown>(categoryBreakdown)
  const maxCategoryBudget = Math.max(...categories.map(c => c.budget), 1)

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6" data-testid="budget-gauge">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{safeDept}</h3>
          <p className="text-xs sm:text-sm text-gray-500">Budget Overview</p>
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium text-white ${cfg.bg}`}>
          {cfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-4" role="progressbar" aria-valuenow={percentUsedLocal} aria-valuemin={0} aria-valuemax={100} aria-label={`${percentUsedLocal.toFixed(1)}% of budget used`}>
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out ${cfg.bg}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>

      {/* Summary numbers */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide truncate">Spent</p>
          <p className="text-sm sm:text-lg font-bold text-gray-900 truncate">{safePrice(spent)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide truncate">Budget</p>
          <p className="text-sm sm:text-lg font-bold text-gray-900 truncate">{safePrice(budgetTotal)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide truncate">Remaining</p>
          <p className={`text-sm sm:text-lg font-bold truncate ${remaining < 0 ? 'text-red-600' : cfg.text}`}>
            {remaining < 0 ? '-' : ''}{safePrice(Math.abs(remaining))}
          </p>
        </div>
      </div>

      {/* Percent indicator */}
      <div className="text-center mb-4">
        <span className="text-xs sm:text-sm text-gray-500">
          {percentUsedLocal.toFixed(1)}% of budget used
        </span>
        {budgetTotal > 1_000_000_00 && ( // > 10 lakh
          <span className="ml-2 text-[10px] sm:text-xs text-gray-400">
            (₹{formatIndian(budgetTotal / 100)} total)
          </span>
        )}
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category Breakdown</p>
          <div className="space-y-3">
            {categories.map((cat, i) => (
              <CategoryBar
                key={cat.name || i}
                name={cat.name}
                budget={cat.budget}
                spent={cat.spent}
                maxBudget={maxCategoryBudget}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetGauge
