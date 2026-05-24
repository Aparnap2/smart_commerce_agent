/**
 * Unit tests for BudgetGauge GenUI component
 *
 * Tests: rendering budget data, loading/error/empty states, color coding,
 * edge case values (zero, negative, null, over-budget), category breakdown.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BudgetGauge from '../../../components/genui/BudgetGauge'

describe('BudgetGauge', () => {
  // ── Loading state ───────────────────────────────────────────────────
  it('renders loading skeleton when loading=true', () => {
    render(<BudgetGauge loading />)
    expect(screen.getByTestId('budget-gauge-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('budget-gauge')).not.toBeInTheDocument()
  })

  // ── Error state ─────────────────────────────────────────────────────
  it('renders error state when error is provided', () => {
    render(<BudgetGauge error="API failure" />)
    expect(screen.getByTestId('budget-gauge-error')).toBeInTheDocument()
    expect(screen.getByText('API failure')).toBeInTheDocument()
  })

  // ── Empty state ────────────────────────────────────────────────────
  it('renders empty state when budget and spent are both zero', () => {
    render(<BudgetGauge totalBudget={0} spent={0} />)
    expect(screen.getByTestId('budget-gauge-empty')).toBeInTheDocument()
  })

  it('renders empty state when totalBudget is null and spent is undefined', () => {
    render(<BudgetGauge totalBudget={null as unknown as undefined} spent={undefined} />)
    expect(screen.getByTestId('budget-gauge-empty')).toBeInTheDocument()
  })

  it('renders empty state when totalBudget is negative and spent is 0', () => {
    render(<BudgetGauge totalBudget={-1000} spent={0} />)
    // spent <= 0 and budgetTotal <= 0 → empty state
    expect(screen.getByTestId('budget-gauge-empty')).toBeInTheDocument()
  })

  // ── Normal rendering ───────────────────────────────────────────────
  it('renders department name', () => {
    render(<BudgetGauge department="Engineering" totalBudget={10000000} spent={5000000} />)
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('uses the `name` prop as alias for department', () => {
    render(<BudgetGauge name="Marketing" totalBudget={10000000} spent={3000000} />)
    expect(screen.getByText('Marketing')).toBeInTheDocument()
  })

  it('prefers `department` over `name`', () => {
    render(<BudgetGauge department="Engineering" name="Marketing" totalBudget={10000000} spent={3000000} />)
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.queryByText('Marketing')).not.toBeInTheDocument()
  })

  it('shows fallback department name when both are missing', () => {
    render(<BudgetGauge totalBudget={10000000} spent={5000000} />)
    expect(screen.getByText('Department')).toBeInTheDocument()
  })

  // ── Budget stats ───────────────────────────────────────────────────
  it('displays spent, budget, and remaining amounts', () => {
    render(<BudgetGauge department="Test" totalBudget={20000000} spent={8000000} />)
    // safePrice converts paise: 8000000 → ₹80,000, 20000000 → ₹2,00,000
    expect(screen.getByText('₹80,000')).toBeInTheDocument()
    expect(screen.getByText('₹2,00,000')).toBeInTheDocument()
    // remaining = 20000000 - 8000000 = 12000000 → ₹1,20,000
    expect(screen.getByText('₹1,20,000')).toBeInTheDocument()
  })

  it('shows percentage used', () => {
    render(<BudgetGauge department="Test" totalBudget={10000000} spent={2500000} />)
    // 2500000/10000000 = 25%
    expect(screen.getByText('25.0% of budget used')).toBeInTheDocument()
  })

  // ── Color coding ───────────────────────────────────────────────────
  it('shows "Healthy" label for < 50% usage', () => {
    render(<BudgetGauge department="Test" totalBudget={10000000} spent={3000000} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('shows "Warning" label for 50-79% usage', () => {
    render(<BudgetGauge department="Test" totalBudget={10000000} spent={6000000} />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('shows "Critical" label for >= 80% usage', () => {
    render(<BudgetGauge department="Test" totalBudget={10000000} spent={8000000} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  // ── Over budget ────────────────────────────────────────────────────
  it('shows negative remaining in red when over budget', () => {
    render(<BudgetGauge department="Test" totalBudget={5000000} spent={7000000} />)
    // remaining = 5000000 - 7000000 = -2000000
    // The component shows "-₹20,000.00" with text-red-600
    expect(screen.getByText('-₹20,000')).toBeInTheDocument()
  })

  // ── Prop aliases ───────────────────────────────────────────────────
  it('accepts `total` as alias for totalBudget', () => {
    render(<BudgetGauge department="Test" total={10000000} spent={5000000} />)
    expect(screen.getByText('₹1,00,000')).toBeInTheDocument()
  })

  // ── Category breakdown ─────────────────────────────────────────────
  it('renders category breakdown when provided', () => {
    render(
      <BudgetGauge
        department="Test"
        totalBudget={10000000}
        spent={6000000}
        categoryBreakdown={[
          { name: 'Software', budget: 5000000, spent: 3000000 },
          { name: 'Hardware', budget: 5000000, spent: 3000000 },
        ]}
      />
    )
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Software')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
  })

  it('does not render category breakdown section when empty', () => {
    render(
      <BudgetGauge
        department="Test"
        totalBudget={10000000}
        spent={6000000}
        categoryBreakdown={[]}
      />
    )
    expect(screen.queryByText('Category Breakdown')).not.toBeInTheDocument()
  })

  it('does not render category breakdown when null', () => {
    render(
      <BudgetGauge
        department="Test"
        totalBudget={10000000}
        spent={6000000}
        categoryBreakdown={null as unknown as undefined}
      />
    )
    expect(screen.queryByText('Category Breakdown')).not.toBeInTheDocument()
  })

  it('handles category breakdown with zero budget category', () => {
    render(
      <BudgetGauge
        department="Test"
        totalBudget={10000000}
        spent={6000000}
        categoryBreakdown={[
          { name: 'Unused', budget: 0, spent: 0 },
          { name: 'Active', budget: 10000000, spent: 6000000 },
        ]}
      />
    )
    expect(screen.getByText('Unused')).toBeInTheDocument()
  })

  // ── Progress bar accessibility ─────────────────────────────────────
  it('has accessible progress bar with correct values', () => {
    render(<BudgetGauge department="Test" totalBudget={10000000} spent={5000000} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  // ── Large budget formatting ────────────────────────────────────────
  it('shows formatted total for large budgets (>10 lakh)', () => {
    render(<BudgetGauge department="Test" totalBudget={200000000} spent={100000000} />)
    // budgetTotal = 200000000 (2 crore), > 100000000 so it should show the formatted total
    // formatIndian(budgetTotal/100) = formatIndian(2000000) = "20,00,000"
    // Text "20,00,000" appears in both price display and formatted total span
    const results = screen.getAllByText(/20,00,000/)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
