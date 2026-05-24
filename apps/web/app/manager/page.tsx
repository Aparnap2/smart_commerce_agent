'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'
import ApprovalCard from '@/components/genui/ApprovalCard'
import BudgetGauge from '@/components/genui/BudgetGauge'
import { useProcurementStore, type DepartmentBudget } from '@/lib/stores/procurement'
import { safeString, safePrice, safeDate } from '@/lib/genui/safe-render'
import { z } from 'zod'

interface UserSession {
  userId: string
  email: string
  role: string
  departmentId?: string | null
  name?: string
}

interface ApprovalDecision {
  id: string
  prNumber: string
  actorName: string
  amount: number
  decision: 'APPROVED' | 'REJECTED'
  createdAt: string
}

const ApprovalFromAPI = z.object({
  id: z.string(),
  prNumber: z.string(),
  requestorName: z.string(),
  totalAmount: z.number(),
  lineItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    vendor: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number()
  })),
  justification: z.string(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  threadId: z.string().nullable()
})

const DepartmentSpendSchema = z.object({
  department: z.string(),
  monthlyBudget: z.number(),
  spent: z.number(),
  remaining: z.number(),
  percentUsed: z.number()
})

const RecentActivitySchema = z.object({
  id: z.string(),
  prNumber: z.string(),
  actorName: z.string(),
  amount: z.number(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  createdAt: z.string()
})

function getTokenPayload(): UserSession | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/)
    if (!match) return null
    const payload = JSON.parse(atob(match[1].split('.')[1]))
    return {
      userId: payload.userId ?? payload.sub ?? '',
      email: payload.email ?? '',
      role: payload.role ?? '',
      departmentId: payload.departmentId ?? null,
      name: payload.name ?? ''
    }
  } catch {
    return null
  }
}

export default function ManagerDashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null)
  const { budget, setBudget, pendingApprovals, setPendingApprovals, isLoading, setIsLoading } = useProcurementStore()
  const [error, setError] = useState<string | null>(null)

  const [departmentSpends, setDepartmentSpends] = useState<DepartmentBudget[]>([])
  const [spendsLoading, setSpendsLoading] = useState(true)
  const [spendsError, setSpendsError] = useState<string | null>(null)

  const [recentActivity, setRecentActivity] = useState<ApprovalDecision[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)

  useEffect(() => {
    setSession(getTokenPayload())
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [budgetRes, approvalsRes] = await Promise.all([
          fetch('/api/department/budget'),
          fetch('/api/approvals/pending')
        ])

        if (budgetRes.ok) {
          const data: DepartmentBudget = await budgetRes.json()
          setBudget(data)
        }

        if (approvalsRes.ok) {
          const data = await approvalsRes.json()
          const validated = z.array(ApprovalFromAPI).parse(data.approvals)
          setPendingApprovals(validated)
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    const fetchSpends = async () => {
      setSpendsLoading(true)
      setSpendsError(null)
      try {
        const res = await fetch('/api/budget/departments')
        if (res.ok) {
          const data = await res.json()
          const list = data.departments ?? data
          const validated = z.array(DepartmentSpendSchema).parse(list)
          setDepartmentSpends(validated)
        }
      } catch (err) {
        console.error('Failed to fetch spends:', err)
        setSpendsError('Failed to load department spend data')
      } finally {
        setSpendsLoading(false)
      }
    }

    const fetchActivity = async () => {
      setActivityLoading(true)
      setActivityError(null)
      try {
        const res = await fetch('/api/approvals/recent-activity')
        if (res.ok) {
          const data = await res.json()
          const list = data.activities ?? data
          const validated = z.array(RecentActivitySchema).parse(list)
          setRecentActivity(validated)
        }
      } catch (err) {
        console.error('Failed to fetch activity:', err)
        setActivityError('Failed to load recent activity')
      } finally {
        setActivityLoading(false)
      }
    }

    fetchData()
    fetchSpends()
    fetchActivity()
  }, [setBudget, setPendingApprovals, setIsLoading])

  const handleDecision = useCallback(async (prId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) => {
    try {
      const res = await fetch(`/api/approvals/${prId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments })
      })

      if (res.ok) {
        setPendingApprovals(pendingApprovals.filter(pr => pr.id !== prId))
        setError(null)
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || 'Failed to submit decision')
      }
    } catch (err) {
      console.error('Failed to submit decision:', err)
      setError('Network error submitting decision')
    }
  }, [pendingApprovals, setPendingApprovals])

  if (!session) {
    return (
      <Shell rail={<Rail />}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell rail={<Rail />}>
      <div data-testid="manager-dashboard" className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome, {safeString(session.name || session.email.split('@')[0], 'Manager')}
          </p>
        </div>

        <div className="p-6 space-y-8 max-w-7xl mx-auto">
          {/* ── Section 1: Pending Approvals ── */}
          <section data-testid="pending-approvals-section">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({pendingApprovals.length})</span>
              )}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="grid gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
                    <div className="flex justify-between mb-4">
                      <div className="space-y-2">
                        <div className="h-5 bg-gray-100 rounded w-44" />
                        <div className="h-3 bg-gray-100 rounded w-32" />
                      </div>
                      <div className="h-6 bg-gray-100 rounded-full w-16" />
                    </div>
                    <div className="h-4 bg-gray-100 rounded w-full mb-3" />
                    <div className="space-y-2">
                      {[1, 2].map(j => (
                        <div key={j} className="flex justify-between">
                          <div className="h-4 bg-gray-100 rounded w-40" />
                          <div className="h-4 bg-gray-100 rounded w-16" />
                        </div>
                      ))}
                    </div>
                    <div className="h-6 bg-gray-100 rounded w-24 mt-4 mb-4" />
                    <div className="flex gap-2">
                      <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
                      <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && pendingApprovals.length === 0 && !error && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">All caught up!</p>
                <p className="text-gray-500 text-sm mt-1">No pending purchase requests to review</p>
              </div>
            )}

            {!isLoading && pendingApprovals.length > 0 && (
              <div className="grid gap-4">
                {pendingApprovals.map((approval) => {
                  const budgetAfter = budget ? budget.remaining - approval.totalAmount : null
                  return (
                    <div key={approval.id} data-testid="pr-item-wrapper">
                      <ApprovalCard
                        prId={approval.id}
                        prNumber={approval.prNumber}
                        requestorName={approval.requestorName}
                        totalAmount={approval.totalAmount}
                        lineItems={approval.lineItems}
                        justification={approval.justification}
                        urgency={approval.urgency}
                        threadId={approval.threadId ?? null}
                        onSubmitDecision={async (decision) => {
                          await handleDecision(approval.id, decision)
                        }}
                      />
                      {budgetAfter !== null && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          Budget remaining after approval: {safePrice(Math.max(0, budgetAfter))}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Section 2: Department Spend ── */}
          <section data-testid="department-spend-section">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Spend</h2>
            <p className="text-sm text-gray-500 mb-4">Current month spend vs budget per department</p>

            {spendsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                <p className="text-red-600 text-sm">{spendsError}</p>
              </div>
            )}

            {spendsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
                    <div className="space-y-2 mb-6">
                      <div className="h-5 bg-gray-100 rounded w-32" />
                      <div className="h-3 bg-gray-100 rounded w-20" />
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full mb-4" />
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map(k => (
                        <div key={k} className="space-y-1 text-center">
                          <div className="h-3 bg-gray-100 rounded w-12 mx-auto" />
                          <div className="h-6 bg-gray-100 rounded w-20 mx-auto" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!spendsLoading && !spendsError && departmentSpends.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-500 font-medium">No department spend data available</p>
              </div>
            )}

            {!spendsLoading && departmentSpends.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departmentSpends.map((dept) => (
                  <BudgetGauge
                    key={dept.department}
                    department={dept.department}
                    totalBudget={dept.monthlyBudget}
                    spent={dept.spent}
                    remaining={dept.remaining}
                    percentUsed={dept.percentUsed}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Section 3: Recent Activity ── */}
          <section data-testid="recent-activity-section">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <p className="text-sm text-gray-500 mb-4">Last 20 approval decisions</p>

            {activityError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                <p className="text-red-600 text-sm">{activityError}</p>
              </div>
            )}

            {activityLoading && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex gap-8">
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-3 bg-gray-200 rounded w-12" />
                    <div className="h-3 bg-gray-200 rounded w-16 ml-auto" />
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="px-6 py-4 flex gap-8">
                      <div className="h-4 bg-gray-100 rounded w-16" />
                      <div className="h-4 bg-gray-100 rounded w-24" />
                      <div className="h-4 bg-gray-100 rounded w-20" />
                      <div className="h-5 bg-gray-100 rounded-full w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!activityLoading && !activityError && recentActivity.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-500 font-medium">No recent approval activity</p>
                <p className="text-gray-400 text-sm mt-1">Decisions will appear here as you process requests</p>
              </div>
            )}

            {!activityLoading && recentActivity.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PR #</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentActivity.map((entry) => (
                        <tr key={entry.id} data-testid="activity-item" className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900 text-sm">#{safeString(entry.prNumber, 'N/A')}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {safeString(entry.actorName, 'Unknown')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {safeDate(entry.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                            {safePrice(entry.amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                entry.decision === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {entry.decision === 'APPROVED' ? (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Approved
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Rejected
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  )
}
