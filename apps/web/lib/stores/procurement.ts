// Procurement Zustand Store
// Manages department budget, pending approvals, and PR draft state

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PRLineItem {
  id: string
  name: string
  vendor: string
  quantity: number
  unitPrice: number
  totalPrice: number
  imageUrl?: string
}

export interface PRDraft {
  prNumber: string
  lineItems: PRLineItem[]
  total: number
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'SUBMITTED'
}

export interface DepartmentBudget {
  department: string
  monthlyBudget: number
  spent: number
  remaining: number
  percentUsed: number
}

export interface PendingApproval {
  id: string
  prNumber: string
  requestorName: string
  totalAmount: number
  lineItems: PRLineItem[]
  justification: string
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  threadId?: string | null
}

interface ProcurementState {
  // Department budget
  budget: DepartmentBudget | null
  setBudget: (budget: DepartmentBudget | null) => void
  
  // Pending approvals (for managers)
  pendingApprovals: PendingApproval[]
  pendingCount: number
  setPendingApprovals: (approvals: PendingApproval[]) => void
  setPendingCount: (count: number) => void
  
  // PR Draft state
  prDraft: PRDraft | null
  setPRDraft: (draft: PRDraft | null) => void
  addLineItem: (item: PRLineItem) => void
  removeLineItem: (itemId: string) => void
  clearPRDraft: () => void
  
  // UI state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  
  // Error state
  error: string | null
  setError: (error: string | null) => void
}

export const useProcurementStore = create<ProcurementState>()(
  persist(
    (set, get) => ({
      // Budget state
      budget: null,
      setBudget: (budget) => set({ budget }),
      
      // Pending approvals
      pendingApprovals: [],
      pendingCount: 0,
      setPendingApprovals: (approvals) => set({ 
        pendingApprovals: approvals,
        pendingCount: approvals.length 
      }),
      setPendingCount: (count) => set({ pendingCount: count }),
      
      // PR Draft
      prDraft: null,
      setPRDraft: (draft) => set({ prDraft: draft }),
      
      addLineItem: (item) => {
        const current = get().prDraft
        if (!current) {
          set({
            prDraft: {
              prNumber: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              lineItems: [item],
              total: item.totalPrice,
              status: 'DRAFT'
            }
          })
        } else {
          const existingIndex = current.lineItems.findIndex(li => li.id === item.id)
          if (existingIndex >= 0) {
            // Update existing item quantity
            const updatedItems = [...current.lineItems]
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + item.quantity,
              totalPrice: (updatedItems[existingIndex].quantity + item.quantity) * item.unitPrice
            }
            set({
              prDraft: {
                ...current,
                lineItems: updatedItems,
                total: updatedItems.reduce((sum, li) => sum + li.totalPrice, 0)
              }
            })
          } else {
            set({
              prDraft: {
                ...current,
                lineItems: [...current.lineItems, item],
                total: current.total + item.totalPrice
              }
            })
          }
        }
      },
      
      removeLineItem: (itemId) => {
        const current = get().prDraft
        if (!current) return
        const updatedItems = current.lineItems.filter(li => li.id !== itemId)
        set({
          prDraft: {
            ...current,
            lineItems: updatedItems,
            total: updatedItems.reduce((sum, li) => sum + li.totalPrice, 0)
          }
        })
      },
      
      clearPRDraft: () => set({ prDraft: null }),
      
      // UI state
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      // Error state
      error: null,
      setError: (error) => set({ error })
    }),
    {
      name: 'procurement-store',
      partialize: (state) => ({
        budget: state.budget,
        prDraft: state.prDraft,
        pendingApprovals: state.pendingApprovals,
        pendingCount: state.pendingCount
      })
    }
  )
)

// Export for testing
export { useProcurementStore as default }