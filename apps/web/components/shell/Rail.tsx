'use client'

import React, { useEffect, useState } from 'react'
import { MessageSquare, Plus, FileText, Package, Settings, ChevronLeft, Bell } from 'lucide-react'
import { useProcurementStore, type DepartmentBudget } from '@/lib/stores/procurement'
import BudgetGauge from '../genui/BudgetGauge'

function getTokenPayload() {
  try {
    const token = document.cookie.split('token=')[1]?.split(';')[0]
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

/**
 * Rail Component - Sidebar navigation panel
 */
export const Rail: React.FC = () => {
    const [session, setSession] = useState<any>(null)
    const { budget, setBudget, pendingCount, setPendingCount } = useProcurementStore()
    const [isLoading, setIsLoading] = useState(true)
    
    useEffect(() => {
      const payload = getTokenPayload()
      setSession(payload ? { user: payload } : null)
    }, [])
    
    const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

    useEffect(() => {
        const fetchBudget = async () => {
            try {
                const res = await fetch('/api/department/budget')
                if (res.ok) {
                    const data: DepartmentBudget = await res.json()
                    setBudget(data)
                }
            } catch (error) {
                console.error('Failed to fetch budget:', error)
            } finally {
                setIsLoading(false)
            }
        }
        
        const fetchPendingCount = async () => {
            if (!isManager) return
            try {
                const res = await fetch('/api/approvals/pending/count')
                if (res.ok) {
                    const data = await res.json()
                    setPendingCount(data.count)
                }
            } catch (error) {
                console.error('Failed to fetch pending count:', error)
            }
        }
        
        fetchBudget()
        if (isManager) {
            fetchPendingCount()
        }
    }, [setBudget, setPendingCount, isManager])

    return (
        <div data-testid="shell-rail" className="rail flex flex-col h-full w-[260px] lg:w-[260px] md:w-[64px]">
            {/* Brand / Toggle */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                    <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs">PA</span>
                    </div>
                    <span className="text-lg hidden md:block lg:block">ProcureAI</span>
                </h2>
                <button className="hidden md:block lg:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-400 shrink-0">
                    <ChevronLeft size={18} />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 shrink-0">
                <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm shrink-0">
                    <Plus size={18} className="shrink-0" />
                    <span className="hidden md:block lg:block whitespace-nowrap">New thread</span>
                </button>
            </div>

            {/* Budget Gauge in Rail */}
            {budget && (
                <div className="px-4 pb-4 shrink-0" data-testid="rail-budget-gauge">
                    <BudgetGauge
                        department={budget.department}
                        monthlyBudget={budget.monthlyBudget}
                        spent={budget.spent}
                        remaining={budget.remaining}
                        percentUsed={budget.percentUsed}
                    />
                </div>
            )}
            
            {/* Loading state for budget */}
            {isLoading && !budget && (
                <div className="px-4 pb-4 shrink-0">
                    <div className="bg-gray-100 rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                    </div>
                </div>
            )}

            {/* Navigation for all users */}
            <div className="px-4 pb-2 shrink-0 space-y-1">
                <a 
                    href="/chat" 
                    data-testid="my-prs-nav"
                    className="flex items-center gap-2 p-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                    <FileText size={16} />
                    <span className="hidden md:block lg:block">My PRs</span>
                </a>
                <a 
                    href="/chat" 
                    data-testid="catalog-nav"
                    className="flex items-center gap-2 p-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                    <Package size={16} />
                    <span className="hidden md:block lg:block">Catalog</span>
                </a>
            </div>

            {/* Pending Approvals (Managers only) */}
            {isManager && pendingCount > 0 && (
                <div className="px-4 pb-2 shrink-0">
                    <a 
                        href="/manager" 
                        data-testid="approvals-nav"
                        data-testid-legacy="rail-pending-link"
                        className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-200 hidden md:block lg:block">
                                Pending Approvals
                            </span>
                        </div>
                        <span 
                            data-testid="rail-pending-count"
                            className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
                        >
                            {pendingCount}
                        </span>
                    </a>
                </div>
            )}

            {/* Thread History */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thin-dark px-2 space-y-1 py-2 min-h-0">
                <div className="px-3 mb-2 hidden md:block lg:block shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Threads</p>
                </div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                    <MessageSquare size={18} className="shrink-0" />
                    <span className="truncate hidden md:block lg:block">Headphones under ₹15k</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm font-medium transition-colors">
                    <MessageSquare size={18} className="shrink-0" />
                    <span className="truncate hidden md:block lg:block">PR tracking PR-992</span>
                </button>
            </div>

            {/* Context Panel */}
            <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 hidden md:block lg:block">Live Context</p>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <FileText size={14} className="shrink-0" />
                            <span className="hidden md:block lg:block whitespace-nowrap">PR Total</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white hidden md:block lg:block">₹44,890</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Package size={14} className="shrink-0" />
                            <span className="hidden md:block lg:block whitespace-nowrap">Last PR</span>
                        </div>
                        <span className="text-green-600 dark:text-green-400 font-medium hidden md:block lg:block">Shipped</span>
                    </div>
                </div>
            </div>

            {/* User / Settings */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                            {session?.user?.name?.[0] || 'U'}
                        </span>
                    </div>
                    <div className="hidden md:flex lg:flex flex-col min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {session?.user?.name || 'Aparna'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{session?.user?.role || session?.user?.employeeRole || 'Employee'}</p>
                    </div>
                    <button className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hidden md:block lg:block shrink-0">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}