/**
 * Unit tests for PurchaseRequestDraft GenUI component
 *
 * Tests: rendering with items, loading/error/empty states, all status variants,
 * prop aliases (lineItems/items/products), submit button behavior.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PurchaseRequestDraft from '../../../components/genui/PurchaseRequestDraft'
import type { PRLineItem } from '../../../components/genui/PurchaseRequestDraft'

const buildItem = (overrides: Partial<PRLineItem> = {}): PRLineItem => ({
  id: 'li-1',
  name: 'Office Chair',
  quantity: 2,
  unitPrice: 15000, // in paise
  totalPrice: 30000, // in paise
  ...overrides,
})

describe('PurchaseRequestDraft', () => {
  // ── Loading state ───────────────────────────────────────────────────
  it('renders loading skeleton when loading=true', () => {
    render(<PurchaseRequestDraft loading />)
    expect(screen.getByTestId('pr-draft-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('pr-draft')).not.toBeInTheDocument()
  })

  // ── Error state ─────────────────────────────────────────────────────
  it('renders error state when error is provided', () => {
    render(<PurchaseRequestDraft error="Failed to load" />)
    expect(screen.getByTestId('pr-draft-error')).toBeInTheDocument()
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  // ── Empty items state ──────────────────────────────────────────────
  it('renders empty items state when no items provided', () => {
    render(<PurchaseRequestDraft />)
    expect(screen.getByTestId('pr-draft-empty')).toBeInTheDocument()
  })

  it('renders empty items state when items array is empty', () => {
    render(<PurchaseRequestDraft items={[]} />)
    expect(screen.getByTestId('pr-draft-empty')).toBeInTheDocument()
  })

  it('renders empty items state when lineItems is null', () => {
    render(<PurchaseRequestDraft lineItems={null as unknown as undefined} />)
    expect(screen.getByTestId('pr-draft-empty')).toBeInTheDocument()
  })

  // ── Normal rendering ───────────────────────────────────────────────
  it('renders PR number and requestor name', () => {
    render(
      <PurchaseRequestDraft
        prNumber="PR-2024-001"
        requestor="Jane Doe"
        items={[buildItem()]}
        total={60000}
      />
    )
    expect(screen.getByTestId('pr-number')).toHaveTextContent('PR-2024-001')
    expect(screen.getByTestId('pr-number')).toHaveTextContent('Jane Doe')
  })

  it('shows fallback when PR number is missing', () => {
    render(<PurchaseRequestDraft items={[buildItem()]} />)
    expect(screen.getByTestId('pr-number')).toHaveTextContent('Draft')
  })

  it('renders line items with quantity and price', () => {
    render(
      <PurchaseRequestDraft
        items={[buildItem({ name: 'Monitor', quantity: 3, unitPrice: 20000, totalPrice: 60000 })]}
      />
    )
    expect(screen.getByText('Monitor')).toBeInTheDocument()
    expect(screen.getByText(/3 ×/)).toBeInTheDocument()
    // unitPrice * 100 = 2000000 paise → ₹20,000 for the unit price display
    expect(screen.getByText(/₹20,000/)).toBeInTheDocument()
  })

  it('shows total amount in the footer', () => {
    render(
      <PurchaseRequestDraft
        items={[buildItem({ totalPrice: 30000 })]}
        total={60000}
      />
    )
    // safePrice(60000) → ₹600
    expect(screen.getByText('₹600')).toBeInTheDocument()
  })

  // ── Prop aliases ───────────────────────────────────────────────────
  it('accepts `lineItems` as prop alias', () => {
    render(<PurchaseRequestDraft lineItems={[buildItem({ name: 'From lineItems' })]} />)
    expect(screen.getByText('From lineItems')).toBeInTheDocument()
  })

  it('accepts `products` as prop alias', () => {
    render(<PurchaseRequestDraft products={[buildItem({ name: 'From products' })]} />)
    expect(screen.getByText('From products')).toBeInTheDocument()
  })

  it('prefers `lineItems` over `items` and `products`', () => {
    render(
      <PurchaseRequestDraft
        lineItems={[buildItem({ name: 'Line Item' })]}
        items={[buildItem({ name: 'Items Prop' })]}
        products={[buildItem({ name: 'Products Prop' })]}
      />
    )
    expect(screen.getByText('Line Item')).toBeInTheDocument()
    expect(screen.queryByText('Items Prop')).not.toBeInTheDocument()
    expect(screen.queryByText('Products Prop')).not.toBeInTheDocument()
  })

  it('accepts `requestedBy` as alias for requestor', () => {
    render(
      <PurchaseRequestDraft
        requestedBy="John Smith"
        items={[buildItem()]}
      />
    )
    // "John Smith" is part of "Draft • John Smith" in the pr-number element
    expect(screen.getByTestId('pr-number')).toHaveTextContent('John Smith')
  })

  // ── Status badges ──────────────────────────────────────────────────
  const statuses = [
    { status: 'DRAFT', label: 'Draft' },
    { status: 'PENDING', label: 'Pending' },
    { status: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { status: 'APPROVED', label: 'Approved' },
    { status: 'REJECTED', label: 'Rejected' },
    { status: 'DISPUTED', label: 'Disputed' },
    { status: 'CANCELLED', label: 'Cancelled' },
  ]

  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" status badge for ${status}`, () => {
      render(<PurchaseRequestDraft status={status} items={[buildItem()]} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('shows "Draft" as default status when status is missing', () => {
    render(<PurchaseRequestDraft items={[buildItem()]} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  // ── Justification ──────────────────────────────────────────────────
  it('renders justification when provided', () => {
    render(
      <PurchaseRequestDraft
        justification="Q4 budget allocation for team expansion"
        items={[buildItem()]}
      />
    )
    expect(screen.getByText('Q4 budget allocation for team expansion')).toBeInTheDocument()
  })

  it('does not render justification section when missing', () => {
    render(<PurchaseRequestDraft items={[buildItem()]} />)
    expect(screen.queryByText('Justification')).not.toBeInTheDocument()
  })

  // ── Created date ───────────────────────────────────────────────────
  it('renders created date when provided', () => {
    render(
      <PurchaseRequestDraft
        createdAt="2024-03-15T10:30:00Z"
        items={[buildItem()]}
      />
    )
    expect(screen.getByText('Created 15 Mar 2024')).toBeInTheDocument()
  })

  it('does not render date section when createdAt is missing', () => {
    render(<PurchaseRequestDraft items={[buildItem()]} />)
    expect(screen.queryByText(/Created/)).not.toBeInTheDocument()
  })

  // ── Submit button ──────────────────────────────────────────────────
  it('shows "Submit for Approval" when items exist', () => {
    render(<PurchaseRequestDraft items={[buildItem()]} />)
    expect(screen.getByText('Submit for Approval')).toBeInTheDocument()
    expect(screen.getByTestId('submit-pr-btn')).not.toBeDisabled()
  })

  it('shows "Add items to submit" when no items exist', () => {
    render(<PurchaseRequestDraft />)
    expect(screen.getByText('Add items to submit')).toBeInTheDocument()
    expect(screen.getByTestId('submit-pr-btn')).toBeDisabled()
  })

  // ── Line item edge cases ───────────────────────────────────────────
  it('handles item with null name', () => {
    render(
      <PurchaseRequestDraft
        items={[buildItem({ name: null as unknown as string })]}
      />
    )
    expect(screen.getByText('Unnamed Item')).toBeInTheDocument()
  })

  it('handles item with null quantity (defaults to 1)', () => {
    render(
      <PurchaseRequestDraft
        items={[buildItem({ quantity: null as unknown as number | undefined })]}
      />
    )
    // qty defaults to 1, unitPrice is 15000 → "1 × ₹1,50,000" (unitPrice * 100 = 15000000 paise)
    const qtyElement = screen.getByText(/×/)
    expect(qtyElement).toHaveTextContent('1 ×')
  })

  it('handles item with missing totalPrice (calculated from qty * unitPrice)', () => {
    render(
      <PurchaseRequestDraft
        items={[buildItem({ totalPrice: null as unknown as number | null, quantity: 3, unitPrice: 10000 })]}
      />
    )
    // lineTotal = safeNumber(null, qty * unitPrice) = safeNumber(null, 3 * 10000) = safeNumber(null, 30000) = 30000
    // safePrice(30000 * 100) = safePrice(3000000) = ₹30,000
    expect(screen.getByText('₹30,000')).toBeInTheDocument()
  })

  it('handles empty items array with still showing PR shell', () => {
    render(<PurchaseRequestDraft prNumber="PR-001" />)
    // The draft shell should still show the PR number even with no items
    expect(screen.getByTestId('pr-number')).toHaveTextContent('PR-001')
    expect(screen.getByTestId('pr-draft-empty')).toBeInTheDocument()
  })
})
