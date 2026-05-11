// Customer-facing GenUI component registry
// Keys MUST match __ui__.name in agent tool responses

interface CatalogItem {
  id: string
  name: string
  vendor?: string
  unitPrice?: number
  price?: number
  formattedPrice?: string
  leadDays?: number
  category?: string
  inStock?: boolean
}

interface PurchaseRequest {
  id?: string
  prNumber?: string
  status?: string
  total?: number
  totalAmount?: number
  department?: string
  requestedBy?: string
  createdAt?: string
  lineItems?: LineItem[]
}

interface LineItem {
  id: string
  name: string
  quantity: number
  unitPrice?: number
  totalPrice?: number
}

interface BudgetData {
  department: string
  monthlyBudget?: number
  spent?: number
  remaining?: number
  percentUsed?: number
}

const CatalogGrid: React.FC<{ items?: CatalogItem[]; loading?: boolean }> = ({ items, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-56" />
        ))}
      </div>
    )
  }

  const safeItems = items ?? []
  if (!safeItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-500 font-medium">No items found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {safeItems.map(item => (
        <div 
          key={item.id} 
          className="group relative bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {item.name}
              </h3>
              <p className="text-sm text-gray-500">{item.vendor ?? 'Unknown Vendor'}</p>
            </div>
            {item.inStock !== false ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">In Stock</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of Stock</span>
            )}
          </div>

          <div className="flex items-baseline justify-between mt-4">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                ₹{item.unitPrice ?? item.price ?? 0}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {item.leadDays ? `${item.leadDays} days` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

const BudgetGauge: React.FC<BudgetData> = ({ department, monthlyBudget: total, spent = 0, remaining, percentUsed = 0 }) => {
  const safeRemaining = remaining ?? ((total ?? 0) - spent)
  const safePercent = percentUsed ?? 0
  
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
          style={{ width: `${Math.min(Math.max(safePercent, 0), 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Spent</p>
          <p className="text-lg font-bold text-gray-900">₹{spent?.toLocaleString() ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Budget</p>
          <p className="text-lg font-bold text-gray-900">₹{total?.toLocaleString() ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
          <p className={`text-lg font-bold ${safeRemaining < 0 ? 'text-red-600' : color.text}`}>
            ₹{safeRemaining?.toLocaleString() ?? 0}
          </p>
        </div>
      </div>
    </div>
  )
}

const PRList: React.FC<{ purchaseRequests?: PurchaseRequest[]; loading?: boolean }> = ({ purchaseRequests, loading }) => {
  const safeRequests = purchaseRequests ?? []

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!safeRequests.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-500 font-medium">No purchase requests</p>
      </div>
    )
  }

  const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PR #</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {safeRequests.map(pr => {
            const safeStatus = pr.status ?? 'UNKNOWN'
            const config = statusConfig[safeStatus] || { bg: 'bg-gray-100', text: 'text-gray-700', label: safeStatus }
            return (
              <tr key={pr.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">#{pr.prNumber ?? 'N/A'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-semibold text-gray-900">₹{(pr.total ?? pr.totalAmount ?? 0).toLocaleString()}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const PurchaseRequestDraft: React.FC<{ prNumber?: string; lineItems?: LineItem[]; total?: number; status?: string }> = ({ 
  prNumber, lineItems = [], total = 0, status = 'DRAFT' 
}) => {
  const statusConfig: Record<string, { bg: string, text: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Purchase Request</h2>
          <p className="text-sm text-gray-500">{prNumber ?? 'Draft'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[status]?.bg ?? 'bg-gray-100'} ${statusConfig[status]?.text ?? 'text-gray-500'}`}>
          {status}
        </span>
      </div>

      <div className="p-6">
        {!lineItems.length ? (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">No items added</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lineItems.map(item => (
              <div key={item.id} className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.quantity} × ₹{item.unitPrice ?? 0}</p>
                </div>
                <span className="font-semibold text-gray-900">₹{item.totalPrice ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Total Amount</span>
        <span className="text-xl font-bold text-indigo-600">₹{total.toLocaleString()}</span>
      </div>
    </div>
  )
}

const VendorAlert: React.FC<{ vendor?: string; expiry?: string }> = ({ vendor, expiry }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <div>
      <p className="font-medium text-amber-800">Vendor Agreement Expiring</p>
      <p className="text-sm text-amber-700">
        {vendor}'s MSA expires {expiry ? `on ${expiry}` : 'soon'}. Consider renegotiating.
      </p>
    </div>
  </div>
)

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
  </div>
)

const BudgetAlert: React.FC<{ department?: string; percentUsed?: number; remaining?: number }> = ({ 
  department, percentUsed = 0, remaining = 0 
}) => {
  const isCritical = percentUsed >= 90
  const isWarning = percentUsed >= 70

  return (
    <div className={`rounded-lg p-4 flex items-start gap-3 ${
      isCritical ? 'bg-red-50 border border-red-200' : isWarning ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'
    }`}>
      <svg className={`w-5 h-5 mt-0.5 ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`} 
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <p className={`font-medium ${isCritical ? 'text-red-800' : isWarning ? 'text-amber-800' : 'text-blue-800'}`}>
          Budget Alert: {department}
        </p>
        <p className={`text-sm ${isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700'}`}>
          {isCritical ? 'Critical' : isWarning ? 'Warning' : 'Notice'}: {percentUsed.toFixed(1)}% spent. 
          ₹{remaining?.toLocaleString() ?? 0} remaining this month.
        </p>
      </div>
    </div>
  )
}

const PRSubmittedCard: React.FC<{ prNumber?: string; total?: number; department?: string }> = ({ 
  prNumber, total = 0, department 
}) => (
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-emerald-900">PR Submitted Successfully</h3>
    <p className="text-emerald-700 mt-2">
      #{prNumber} for ₹{total.toLocaleString()} has been submitted for approval.
    </p>
    <p className="text-sm text-emerald-600 mt-1">
      Manager will be notified. Typically responds in 24-48 hours.
    </p>
  </div>
)

// Component registry - keys MUST match __ui__.name from agent
const CustomerComponentMap = {
  'catalog-grid': CatalogGrid,
  'budget-gauge': BudgetGauge,
  'budget-alert': BudgetAlert,
  'pr-list': PRList,
  'pr-draft': PurchaseRequestDraft,
  'purchase-request-draft': PurchaseRequestDraft,
  'pr-submitted': PRSubmittedCard,
  'vendor-alert': VendorAlert,
  'loading-spinner': LoadingSpinner,
  'product-grid': CatalogGrid,
  'cart-canvas': () => null,
  'order-card': () => null,
  'return-card': () => null,
  'action-confirm': () => null,
  'agent-thinking': LoadingSpinner,
}

export default CustomerComponentMap