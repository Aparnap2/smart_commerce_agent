// Merchant/Manager-facing GenUI component registry

interface ApprovalRequest {
  id: string
  prNumber: string
  requestor: string
  department: string
  totalAmount: number
  urgency: string
  justification: string
  lineItems: { name: string; quantity: number; unitPrice: number }[]
  createdAt: string
}

interface BudgetOverview {
  department: string
  totalBudget: number
  spent: number
  remaining: number
  percentUsed: number
}

const ApprovalCard: React.FC<{ request: ApprovalRequest }> = ({ request }) => {
  const urgencyColors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    NORMAL: 'bg-blue-100 text-blue-700', 
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">PR #{request.prNumber}</h3>
          <p className="text-sm text-gray-500">{request.requestor} · {request.department}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${urgencyColors[request.urgency] ?? 'bg-gray-100 text-gray-700'}`}>
          {request.urgency ?? 'NORMAL'}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Justification</p>
        <p className="text-sm text-gray-700">{request.justification}</p>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
        <div className="space-y-2">
          {request.lineItems?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{item.quantity}x {item.name}</span>
              <span className="font-medium">₹{(item.unitPrice * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">₹{request.totalAmount?.toLocaleString() ?? 0}</span>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">
            Reject
          </button>
          <button className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200">
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

const BudgetOverviewCard: React.FC<BudgetOverview> = ({ department, totalBudget, spent, remaining, percentUsed }) => {
  const getStatusColor = () => {
    if (percentUsed >= 90) return 'text-red-600'
    if (percentUsed >= 70) return 'text-amber-600'
    return 'text-emerald-600'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{department} Budget</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Total Budget</p>
          <p className="text-xl font-bold">₹{totalBudget?.toLocaleString() ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Spent</p>
          <p className={`text-xl font-bold ${getStatusColor()}`}>₹{spent?.toLocaleString() ?? 0}</p>
        </div>
      </div>

      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`absolute h-full rounded-full ${
            percentUsed >= 90 ? 'bg-red-500' : percentUsed >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{percentUsed?.toFixed(1)}% utilized · ₹{remaining?.toLocaleString() ?? 0} remaining</p>
    </div>
  )
}

const DisputeCard: React.FC<{ prNumber?: string; reason?: string; requestor?: string }> = ({ prNumber, reason, requestor }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
    <div className="flex items-start gap-3">
      <svg className="w-6 h-6 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1">
        <h3 className="font-semibold text-red-900">PR #{prNumber} Disputed</h3>
        <p className="text-sm text-red-700 mt-1">{reason}</p>
        <p className="text-xs text-red-600 mt-2">By {requestor}</p>
      </div>
      <button className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-100">
        Review
      </button>
    </div>
  </div>
)

const BulkActionConfirm: React.FC<{ count: number; action: string; onConfirm?: () => void; onCancel?: () => void }> = ({ 
  count, action, onConfirm, onCancel 
}) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">Confirm {action}</h3>
        <p className="text-sm text-gray-500">This will affect {count} purchase request(s)</p>
      </div>
      <button onClick={onCancel} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
        Cancel
      </button>
      <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
        Confirm
      </button>
    </div>
  </div>
)

// Component registry - keys MUST match __ui__.name from agent
const MerchantComponentMap = {
  'approval-card': ApprovalCard,
  'budget-overview': BudgetOverviewCard,
  'dispute-card': DisputeCard,
  'bulk-action-confirm': BulkActionConfirm,
  'revenue-card': BudgetOverviewCard, // alias
  'merchant-briefing': () => null,
  'inventory-alert': () => null,
  'action-confirm': () => null,
}

export default MerchantComponentMap