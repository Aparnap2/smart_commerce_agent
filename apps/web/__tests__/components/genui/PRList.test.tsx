/**
 * Unit tests for PRList GenUI component
 *
 * Tests: rendering requests, loading/error/empty states, null handling,
 * responsive layouts (mobile cards, desktop table).
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PRList from '../../../components/genui/PRList'
import type { PRItem } from '../../../components/genui/PRList'

const buildPR = (overrides: Partial<PRItem> = {}): PRItem => ({
  id: 'pr-1',
  prNumber: 'PR-001',
  status: 'DRAFT',
  total: 5000000,
  department: 'Engineering',
  requestedBy: 'Jane Doe',
  createdAt: '2024-03-15T10:30:00Z',
  ...overrides,
})

describe('PRList', () => {
  // ── Loading state ───────────────────────────────────────────────────
  it('renders loading skeleton when loading=true', () => {
    render(<PRList loading />)
    expect(screen.getByTestId('pr-list-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('pr-list')).not.toBeInTheDocument()
  })

  // ── Error state ─────────────────────────────────────────────────────
  it('renders error state when error is provided', () => {
    render(<PRList error="Failed to fetch" />)
    expect(screen.getByTestId('pr-list-error')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  // ── Empty state ────────────────────────────────────────────────────
  it('renders empty state when requests array is empty', () => {
    render(<PRList requests={[]} />)
    expect(screen.getByTestId('pr-list-empty')).toBeInTheDocument()
  })

  it('renders empty state when requests is null', () => {
    render(<PRList requests={null as unknown as undefined} />)
    expect(screen.getByTestId('pr-list-empty')).toBeInTheDocument()
  })

  it('renders empty state when requests is undefined', () => {
    render(<PRList />)
    expect(screen.getByTestId('pr-list-empty')).toBeInTheDocument()
  })

  // ── Normal rendering ───────────────────────────────────────────────
  it('renders PR items in the table', () => {
    const requests = [
      buildPR({ id: '1', prNumber: 'PR-001', requestedBy: 'Alice' }),
      buildPR({ id: '2', prNumber: 'PR-002', requestedBy: 'Bob' }),
    ]
    render(<PRList requests={requests} />)
    expect(screen.getByTestId('pr-list')).toBeInTheDocument()
    // Desktop table rows
    const items = screen.getAllByTestId('pr-item')
    expect(items).toHaveLength(2)
    // PR numbers render in both mobile cards and desktop table
    expect(screen.getAllByText('#PR-001').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('#PR-002').length).toBeGreaterThanOrEqual(1)
    // Names appear in both mobile cards and desktop table
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1)
  })

  // ── Status chips ──────────────────────────────────────────────────
  const statuses = [
    { status: 'DRAFT', label: 'Draft' },
    { status: 'PENDING', label: 'Pending' },
    { status: 'PENDING_APPROVAL', label: 'Pending' },
    { status: 'APPROVED', label: 'Approved' },
    { status: 'REJECTED', label: 'Rejected' },
    { status: 'DISPUTED', label: 'Disputed' },
    { status: 'CANCELLED', label: 'Cancelled' },
  ]

  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" status chip for ${status}`, () => {
      render(<PRList requests={[buildPR({ status })]} />)
      // both mobile and desktop render status
      const statusEls = screen.getAllByText(label)
      expect(statusEls.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows status key as fallback for unknown status', () => {
    render(<PRList requests={[buildPR({ status: 'UNKNOWN_STATUS' })]} />)
    // Status chip renders in both mobile + desktop
    const chips = screen.getAllByText('UNKNOWN_STATUS')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  // ── Null/missing field handling ────────────────────────────────────
  it('handles missing prNumber with fallback', () => {
    render(<PRList requests={[buildPR({ prNumber: undefined })]} />)
    // PR number appears in both mobile card + desktop table
    const fallbackElements = screen.getAllByText('#N/A')
    expect(fallbackElements.length).toBeGreaterThanOrEqual(1)
  })

  it('handles missing requestedBy with fallback', () => {
    render(<PRList requests={[buildPR({ requestedBy: null as unknown as string | undefined })]} />)
    const unknownElements = screen.getAllByText('Unknown')
    expect(unknownElements.length).toBeGreaterThanOrEqual(1)
  })

  it('handles missing department gracefully', () => {
    render(<PRList requests={[buildPR({ department: null as unknown as string | undefined })]} />)
    // safeString(null) returns '—'
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('handles missing total gracefully', () => {
    render(<PRList requests={[buildPR({ total: undefined, totalAmount: undefined })]} />)
    // Total appears in mobile card + desktop table — safePrice(0) returns ₹0
    const zeroAmounts = screen.getAllByText('₹0')
    expect(zeroAmounts.length).toBeGreaterThanOrEqual(1)
  })

  it('uses totalAmount as fallback for total', () => {
    render(<PRList requests={[buildPR({ total: undefined, totalAmount: 1000000 })]} />)
    const amounts = screen.getAllByText('₹10,000')
    expect(amounts.length).toBeGreaterThanOrEqual(1)
  })

  // ── Total amount formatting ────────────────────────────────────────
  it('displays total amount correctly with paise conversion', () => {
    render(<PRList requests={[buildPR({ total: 1499999 })]} />)
    // safePrice(1499999) = ₹14,999.99 — appears in both mobile + desktop
    const amounts = screen.getAllByText('₹14,999.99')
    expect(amounts.length).toBeGreaterThanOrEqual(1)
  })

  // ── Date display ───────────────────────────────────────────────────
  it('renders created date when provided', () => {
    render(<PRList requests={[buildPR()]} />)
    // Date appears in both mobile card (always visible) + desktop table (lg:) — no comma in jsdom en-IN locale
    const dates = screen.getAllByText('15 Mar 2024')
    expect(dates.length).toBeGreaterThanOrEqual(1)
  })

  it('does not crash when createdAt is missing', () => {
    render(<PRList requests={[buildPR({ createdAt: undefined })]} />)
    // Should still render without date, no crash
    expect(screen.getByTestId('pr-list')).toBeInTheDocument()
  })

  // ── Responsive layout ──────────────────────────────────────────────
  it('has table headers with proper scope attributes', () => {
    render(<PRList requests={[buildPR()]} />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBeGreaterThan(0)
    headers.forEach(th => {
      expect(th).toHaveAttribute('scope', 'col')
    })
  })

  it('renders the table with min-w-[500px] for horizontal scroll', () => {
    const { container } = render(<PRList requests={[buildPR()]} />)
    const table = container.querySelector('table')
    expect(table).toHaveClass('min-w-[500px]')
  })

  // ── Edge cases ─────────────────────────────────────────────────────
  it('handles very long requester names without breaking layout', () => {
    const longName = 'A'.repeat(150)
    render(<PRList requests={[buildPR({ requestedBy: longName })]} />)
    const names = screen.getAllByText(longName)
    expect(names.length).toBeGreaterThanOrEqual(1)
  })

  it('handles single item correctly', () => {
    render(<PRList requests={[buildPR()]} />)
    expect(screen.getAllByTestId('pr-item')).toHaveLength(1)
  })
})
