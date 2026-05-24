'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'
import { safePrice, formatIndian, safeDate } from '@/lib/genui/safe-render'

// ── Types ──────────────────────────────────────────────────────────────────

interface DepartmentBudget {
  id: string
  name: string
  code: string
  monthlyBudget: number
  spent: number
  remaining: number
  percentUsed: number
}

interface SpendMonth {
  month: string
  total: number
  count: number
}

interface CategorySpend {
  category: string
  total: number
  prCount: number
}

interface FlaggedItem {
  id: string
  name: string
  sku: string
  vendor: string
  vendorCode: string
  category: string
  unitPrice: number
  marketMedianPrice: number | null
  pricePremiumPct: number
  flaggedAt: string | null
}

interface MeInfo {
  userId: string
  role: string
  name: string
}

interface SectionState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

// ── Loading Skeleton ────────────────────────────────────────────────────────

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  )
}

// ── Error Block ─────────────────────────────────────────────────────────────

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

// ── Bar Chart Components ────────────────────────────────────────────────────

function HorizontalBar({ value, max, label, color = 'bg-indigo-500' }: {
  value: number; max: number; label: string; color?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-24 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function VerticalBar({ value, max, label, color = 'bg-indigo-500' }: {
  value: number; max: number; label: string; color?: string
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
        ₹{(value / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>
      <div className="w-full flex-1 flex flex-col justify-end" style={{ height: 100 }}>
        <div
          className={`w-full ${color} rounded-t transition-all duration-500`}
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

// ── Main Dashboard Page ─────────────────────────────────────────────────────

export default function FinanceDashboardPage() {
  // User info
  const [me, setMe] = useState<MeInfo | null>(null)

  // Section states
  const [budgetState, setBudgetState] = useState<SectionState<DepartmentBudget[]>>({ data: null, loading: true, error: null })
  const [trendState, setTrendState] = useState<SectionState<SpendMonth[]>>({ data: null, loading: true, error: null })
  const [catState, setCatState] = useState<SectionState<CategorySpend[]>>({ data: null, loading: true, error: null })
  const [flaggedState, setFlaggedState] = useState<SectionState<FlaggedItem[]>>({ data: null, loading: true, error: null })
  const [resolving, setResolving] = useState<Set<string>>(new Set())

  const fetchSection = useCallback(async <T,>(
    url: string,
    extract: (json: Record<string, unknown>) => T,
    setter: (state: SectionState<T>) => void,
  ) => {
    setter({ data: null, loading: true, error: null })
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as Record<string, unknown>).error as string || `Request failed (${res.status})`)
      }
      const json = await res.json() as Record<string, unknown>
      setter({ data: extract(json), loading: false, error: null })
    } catch (err) {
      setter({ data: null, loading: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [])

  // Fetch all data on mount
  useEffect(() => {
    fetchSection('/api/finance/me', (j) => j as unknown as MeInfo, (s) => {
      setMe(s.data)
    })

    fetchSection(
      '/api/finance/budget-by-department',
      (j) => (j.departments ?? []) as DepartmentBudget[],
      setBudgetState,
    )

    fetchSection(
      '/api/finance/spend-trend',
      (j) => (j.months ?? []) as SpendMonth[],
      setTrendState,
    )

    fetchSection(
      '/api/finance/top-categories',
      (j) => (j.categories ?? []) as CategorySpend[],
      setCatState,
    )

    fetchSection(
      '/api/finance/flagged-items',
      (j) => (j.items ?? []) as FlaggedItem[],
      setFlaggedState,
    )
  }, [fetchSection])

  const handleResolve = useCallback(async (itemId: string) => {
    setResolving(prev => new Set(prev).add(itemId))
    try {
      const res = await fetch(`/api/finance/flagged-items/${itemId}/resolve`, { method: 'POST' })
      if (!res.ok) return
      setFlaggedState(prev => ({
        ...prev,
        data: prev.data?.filter(i => i.id !== itemId) ?? null,
      }))
    } catch {
      // silently fail
    } finally {
      setResolving(prev => { const n = new Set(prev); n.delete(itemId); return n })
    }
  }, [])

  // ── Computed values ─────────────────────────────────────────────────────
  const maxDeptBudget = Math.max(
    ...(budgetState.data ?? []).map(d => d.monthlyBudget),
    1,
  )
  const maxTrend = Math.max(
    ...(trendState.data ?? []).map(m => m.total),
    1,
  )
  const maxCategory = Math.max(
    ...(catState.data ?? []).map(c => c.total),
    1,
  )

  return (
    <Shell rail={<Rail />}>
      <div data-testid="finance-dashboard" className="min-h-screen bg-gray-50">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
            <p className="text-sm text-gray-500">
              {me?.name ?? 'Loading...'}
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {me?.role ?? '—'}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Row 1: Budget + Categories ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Budget Utilisation by Department */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Budget Utilisation by Department</h2>
                <p className="text-xs text-gray-500 mt-0.5">Current month allocation vs. spend</p>
              </div>
              {budgetState.loading ? <CardSkeleton rows={4} /> : budgetState.error ? <ErrorBlock message={budgetState.error} /> : !budgetState.data || budgetState.data.length === 0 ? <EmptyBlock message="No department budget data available" /> : (
                <div className="p-5 space-y-4">
                  {budgetState.data.map(dept => (
                    <div key={dept.id}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                        <span className="text-xs text-gray-500">
                          ₹{(dept.spent / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / ₹{(dept.monthlyBudget / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${dept.percentUsed > 90 ? 'bg-red-500' : dept.percentUsed > 75 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, dept.percentUsed)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium w-10 text-right ${dept.percentUsed > 90 ? 'text-red-600' : dept.percentUsed > 75 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {dept.percentUsed}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>Remaining: ₹{(dept.remaining / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Spend Categories */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Top Spend Categories</h2>
                <p className="text-xs text-gray-500 mt-0.5">By total spend (all time)</p>
              </div>
              {catState.loading ? <CardSkeleton rows={5} /> : catState.error ? <ErrorBlock message={catState.error} /> : !catState.data || catState.data.length === 0 ? <EmptyBlock message="No category spend data" /> : (
                <div className="p-5 space-y-4">
                  {catState.data.map(cat => (
                    <div key={cat.category}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700 capitalize">{cat.category.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-semibold text-gray-900">
                          ₹{(cat.total / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <HorizontalBar
                        value={cat.total}
                        max={maxCategory}
                        label=""
                      />
                      <p className="text-xs text-gray-400 mt-0.5">{cat.prCount} purchase request{cat.prCount !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: Monthly Spend Trend ─────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Monthly Spend Trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">Last 6 months — approved &amp; ordered PRs</p>
            </div>
            {trendState.loading ? <CardSkeleton rows={2} /> : trendState.error ? <ErrorBlock message={trendState.error} /> : !trendState.data || trendState.data.length === 0 ? <EmptyBlock message="No spend trend data available" /> : (
              <div className="p-5">
                <div className="flex items-end gap-3 min-h-[160px]">
                  {trendState.data.map(m => (
                    <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center">
                      <VerticalBar
                        value={m.total}
                        max={maxTrend}
                        label={formatMonthLabel(m.month)}
                        color="bg-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Row 3: Flagged Items ────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Flagged Items</h2>
                <p className="text-xs text-gray-500 mt-0.5">Items where vendor price is &gt;15% above market median</p>
              </div>
              {flaggedState.data && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  {flaggedState.data.length} flag{flaggedState.data.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {flaggedState.loading ? <CardSkeleton rows={3} /> : flaggedState.error ? <ErrorBlock message={flaggedState.error} /> : !flaggedState.data || flaggedState.data.length === 0 ? <EmptyBlock message="No items currently flagged" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Item</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Vendor</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Catalog Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Market Median</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Premium</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {flaggedState.data.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">{item.vendor}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                          {safePrice(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                          {item.marketMedianPrice ? safePrice(item.marketMedianPrice) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            item.pricePremiumPct > 30
                              ? 'bg-red-50 text-red-700'
                              : item.pricePremiumPct > 15
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-50 text-gray-600'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {item.pricePremiumPct}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleResolve(item.id)}
                            disabled={resolving.has(item.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {resolving.has(item.id) ? (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Resolving
                              </span>
                            ) : 'Resolve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[m - 1] ?? ym
}
