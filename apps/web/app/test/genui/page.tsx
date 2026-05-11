'use client'

import CatalogGrid from '@/components/genui/CatalogGrid'
import PurchaseRequestDraft from '@/components/genui/PurchaseRequestDraft'
import BudgetGauge from '@/components/genui/BudgetGauge'
import ApprovalCard from '@/components/genui/ApprovalCard'
import PRList from '@/components/genui/PRList'

export default function GenUITestPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <h1 className="text-2xl font-bold">GenUI Edge Case Tests</h1>
      
      <section>
        <h2 className="text-xl font-semibold mb-4">CatalogGrid - Edge Cases</h2>
        <div className="border p-4 rounded">
          <h3 className="font-medium mb-2">1. Missing unitPrice (null)</h3>
          <CatalogGrid items={[{ id: '1', name: 'Test Item', vendor: 'Acme', unitPrice: null as unknown as number, leadDays: 5 }]} />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">2. Empty array</h3>
          <CatalogGrid items={[]} />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">3. Undefined items</h3>
          <CatalogGrid items={undefined} />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">4. Large numbers</h3>
          <CatalogGrid items={[{ id: '1', name: 'Enterprise License', vendor: 'Microsoft', unitPrice: 999999999999, leadDays: 30 }]} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">PRDraft - Edge Cases</h2>
        <div className="border p-4 rounded">
          <h3 className="font-medium mb-2">1. Empty items</h3>
          <PurchaseRequestDraft items={[]} total={0} />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">2. With items</h3>
          <PurchaseRequestDraft items={[{ id: '1', name: 'Laptop', quantity: 2, unitPrice: 50000, totalPrice: 100000 }]} total={100000} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">BudgetGauge - Edge Cases</h2>
        <div className="border p-4 rounded">
          <h3 className="font-medium mb-2">1. Zero budget</h3>
          <BudgetGauge spent={0} total={0} department="Engineering" />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">2. Exceeded budget</h3>
          <BudgetGauge spent={150000} total={100000} department="Engineering" />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">3. Undefined values</h3>
          <BudgetGauge spent={undefined as unknown as number} total={undefined as unknown as number} department="Engineering" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">ApprovalCard - Edge Cases</h2>
        <div className="border p-4 rounded">
          <h3 className="font-medium mb-2">1. Missing requester</h3>
          <ApprovalCard 
            pr={{
              id: '1',
              prNumber: 'PR-001',
              status: 'PENDING',
              requestedBy: '',
              department: 'Engineering',
              total: 50000,
              createdAt: new Date().toISOString(),
              lineItems: []
            }}
            onApprove={() => {}}
            onReject={() => {}}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">PRList - Edge Cases</h2>
        <div className="border p-4 rounded">
          <h3 className="font-medium mb-2">1. Empty list</h3>
          <PRList requests={[]} />
        </div>
        <div className="border p-4 rounded mt-4">
          <h3 className="font-medium mb-2">2. Mixed status</h3>
          <PRList requests={[
            { id: '1', prNumber: 'PR-001', status: 'DRAFT', total: 1000, department: 'Eng', requestedBy: 'a@b.com', createdAt: '2026-01-01' },
            { id: '2', prNumber: 'PR-002', status: 'PENDING', total: 5000, department: 'Eng', requestedBy: 'a@b.com', createdAt: '2026-01-02' },
            { id: '3', prNumber: 'PR-003', status: 'UNKNOWN', total: 0, department: 'Eng', requestedBy: 'a@b.com', createdAt: '2026-01-03' },
          ]} />
        </div>
      </section>
    </div>
  )
}