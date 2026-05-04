'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell/Shell'
import { Rail } from '@/components/shell/Rail'
import ApprovalCard from '@/components/genui/ApprovalCard'
import BudgetGauge from '@/components/genui/BudgetGauge'
import PRList from '@/components/genui/PRList'
import { useProcurementStore, type PendingApproval, type DepartmentBudget } from '@/lib/stores/procurement'
import { z } from 'zod'

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

const PendingApprovalSchema = ApprovalFromAPI

export default function ManagerDashboardPage() {
  const { data: session, status } = useSession()
  const { budget, setBudget, pendingApprovals, setPendingApprovals, isLoading, setIsLoading } = useProcurementStore()
  const [error, setError] = useState<string | null>(null)

  // Redirect non-managers
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/auth/login')
    }
    const isManager = session.user?.role === 'MERCHANT' || session.user?.employeeRole === 'MANAGER'
    if (!isManager) {
      redirect('/chat')
    }
  }, [session, status])

  // Fetch budget and pending approvals
  useEffect(() => {
    if (status !== 'authenticated') return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch budget
        const budgetRes = await fetch('/api/department/budget')
        if (budgetRes.ok) {
          const budgetData: DepartmentBudget = await budgetRes.json()
          setBudget(budgetData)
        }

        // Fetch pending approvals
        const approvalsRes = await fetch('/api/approvals/pending')
        if (approvalsRes.ok) {
          const data = await approvalsRes.json()
          const validated = z.array(PendingApprovalSchema).parse(data.approvals)
          setPendingApprovals(validated)
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [status, setBudget, setPendingApprovals, setIsLoading])

  const handleDecision = async (prId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) => {
    try {
      const res = await fetch(`/api/approvals/${prId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments })
      })

      if (res.ok) {
        // Update local state to remove the processed PR
        const updated = pendingApprovals.filter(pr => pr.id !== prId)
        setPendingApprovals(updated)
      }
    } catch (err) {
      console.error('Failed to submit decision:', err)
    }
  }

  if (status === 'loading') {
    return (
      <Shell rail={<Rail />}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell rail={<Rail />}>
      <div data-testid="manager-dashboard" className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-sm text-gray-500">Review and approve purchase requests</p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Budget & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Budget Gauge */}
            <div data-testid="budget-section">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Department Budget</h2>
              {budget && (
                <BudgetGauge
                  department={budget.department}
                  monthlyBudget={budget.monthlyBudget}
                  spent={budget.spent}
                  remaining={budget.remaining}
                  percentUsed={budget.percentUsed}
                />
              )}
              {isLoading && (
                <div className="bg-gray-100 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                </div>
              )}
            </div>

            {/* Stats Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pending Items</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p data-testid="pending-count" className="text-3xl font-bold text-indigo-600">{pendingApprovals.length}</p>
                  <p className="text-sm text-gray-500">Requests awaiting approval</p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-amber-600 text-xl">⏳</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Approvals */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Approvals */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Pending Approvals ({pendingApprovals.length})
              </h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {pendingApprovals.length === 0 && !isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-gray-600 font-medium">All caught up!</p>
                  <p className="text-gray-500 text-sm">No pending purchase requests to review</p>
                </div>
              )}

              <div data-testid="pr-list" className="space-y-4">
                {pendingApprovals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    prId={approval.id}
                    prNumber={approval.prNumber}
                    requestorName={approval.requestorName}
                    totalAmount={approval.totalAmount}
                    lineItems={approval.lineItems}
                    justification={approval.justification}
                    urgency={approval.urgency}
                    threadId={approval.threadId}
                  />
                ))}
              </div>

              {/* Approval Cards for quick actions */}
              <div className="mt-6 space-y-4">
                {pendingApprovals.map((approval) => (
                  <div 
                    key={approval.id}
                    data-testid="approval-card"
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="font-semibold text-gray-900">{approval.prNumber}</div>
                        <div className="text-sm text-gray-500">from {approval.requestorName}</div>
                      </div>
                      <div className={`border px-2 py-1 rounded text-xs font-medium ${
                        approval.urgency === 'CRITICAL' ? 'border-red-500 text-red-600' :
                        approval.urgency === 'HIGH' ? 'border-amber-400 text-amber-600' :
                        'border-gray-400 text-gray-700'
                      }`}>
                        {approval.urgency}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">Justification</div>
                      <div className="text-sm text-gray-700">{approval.justification}</div>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">Items ({approval.lineItems.length})</div>
                      {approval.lineItems.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-gray-700">{item.quantity} × {item.name}</span>
                          <span className="text-gray-900">₹{item.totalPrice.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 mb-3">
                      <span className="font-medium text-gray-600">Total</span>
                      <span className="text-lg font-bold text-indigo-600">₹{approval.totalAmount.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        data-testid="reject-pr-btn"
                        onClick={() => handleDecision(approval.id, 'REJECTED')}
                        className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg font-medium hover:bg-red-50"
                      >
                        ✕ Reject
                      </button>
                      <button
                        data-testid="approve-pr-btn"
                        onClick={() => handleDecision(approval.id, 'APPROVED')}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                      >
                        ✓ Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}