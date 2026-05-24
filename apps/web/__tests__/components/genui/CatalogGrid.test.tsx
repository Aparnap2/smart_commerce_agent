/**
 * Unit tests for CatalogGrid GenUI component
 *
 * Tests: rendering items, loading skeleton, error state, empty state,
 * prop aliases, null handling, edge case values, out-of-stock behavior.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CatalogGrid from '../../../components/genui/CatalogGrid'
import type { CatalogItem } from '../../../components/genui/CatalogGrid'

// Helper to build a minimal valid item
const buildItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'item-1',
  name: 'Test Product',
  vendor: 'Test Vendor',
  unitPrice: 14999, // in paise
  ...overrides,
})

describe('CatalogGrid', () => {
  // ── Loading state ───────────────────────────────────────────────────
  it('renders loading skeleton when loading=true', () => {
    render(<CatalogGrid loading />)
    expect(screen.getByTestId('catalog-skeleton')).toBeInTheDocument()
    // Should not render content
    expect(screen.queryByTestId('catalog-grid')).not.toBeInTheDocument()
  })

  // ── Error state ─────────────────────────────────────────────────────
  it('renders error state when error is provided', () => {
    render(<CatalogGrid error="Network error" />)
    expect(screen.getByTestId('catalog-error')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('does not render error when both error and items are provided', () => {
    // error takes precedence
    render(<CatalogGrid items={[buildItem()]} error="Server error" />)
    expect(screen.getByTestId('catalog-error')).toBeInTheDocument()
    expect(screen.queryByTestId('catalog-grid')).not.toBeInTheDocument()
  })

  // ── Empty state ────────────────────────────────────────────────────
  it('renders empty state when items array is empty', () => {
    render(<CatalogGrid items={[]} />)
    expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
  })

  it('renders empty state when items is null', () => {
    render(<CatalogGrid items={null as unknown as undefined} />)
    expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
  })

  it('renders empty state when items is undefined', () => {
    render(<CatalogGrid />)
    expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
  })

  // ── Normal rendering ───────────────────────────────────────────────
  it('renders items in a grid', () => {
    const items = [buildItem({ id: '1', name: 'Product A' }), buildItem({ id: '2', name: 'Product B' })]
    render(<CatalogGrid items={items} />)
    expect(screen.getByTestId('catalog-grid')).toBeInTheDocument()
    expect(screen.getAllByTestId('catalog-item')).toHaveLength(2)
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Product B')).toBeInTheDocument()
  })

  it('renders items from the `products` prop alias', () => {
    const products = [buildItem({ id: '1', name: 'From Products' })]
    render(<CatalogGrid products={products} />)
    expect(screen.getByText('From Products')).toBeInTheDocument()
  })

  it('prefers `items` over `products` when both are provided', () => {
    const items = [buildItem({ id: '1', name: 'Items Prop' })]
    const products = [buildItem({ id: '2', name: 'Products Prop' })]
    render(<CatalogGrid items={items} products={products} />)
    expect(screen.getByText('Items Prop')).toBeInTheDocument()
    expect(screen.queryByText('Products Prop')).not.toBeInTheDocument()
  })

  // ── Price handling ─────────────────────────────────────────────────
  it('shows price when unitPrice is provided', () => {
    render(<CatalogGrid items={[buildItem({ unitPrice: 14999 })]} />)
    // unitPrice * 100 = 1499900 paise → safePrice → ₹14,999
    expect(screen.getByText('₹14,999')).toBeInTheDocument()
  })

  it('shows "Price on request" when both price fields are null', () => {
    render(<CatalogGrid items={[buildItem({ unitPrice: null, price: null })]} />)
    expect(screen.getByText('Price on request')).toBeInTheDocument()
  })

  it('shows "Price on request" when both price fields are undefined', () => {
    const item = buildItem({ unitPrice: undefined, price: undefined })
    render(<CatalogGrid items={[item]} />)
    expect(screen.getByText('Price on request')).toBeInTheDocument()
  })

  it('shows "Price on request" when unitPrice is 0 and price is null', () => {
    render(<CatalogGrid items={[buildItem({ unitPrice: 0, price: null })]} />)
    expect(screen.getByText('Price on request')).toBeInTheDocument()
  })

  it('uses price as fallback when unitPrice is null', () => {
    render(<CatalogGrid items={[buildItem({ unitPrice: null, price: 24999 })]} />)
    // price=24999 → itemPrice=24999 → safePrice(24999*100) → ₹24,999
    expect(screen.getByText('₹24,999')).toBeInTheDocument()
  })

  // ── Out of stock ───────────────────────────────────────────────────
  it('shows "Out of Stock" badge and disabled button for out-of-stock items', () => {
    render(<CatalogGrid items={[buildItem({ inStock: false })]} />)
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('shows "In Stock" badge and enabled button for in-stock items', () => {
    render(<CatalogGrid items={[buildItem({ inStock: true })]} />)
    expect(screen.getByText('In Stock')).toBeInTheDocument()
    expect(screen.getByText('Add to PR')).toBeInTheDocument()
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
  })

  it('shows "In Stock" by default when inStock is undefined', () => {
    render(<CatalogGrid items={[buildItem({ inStock: undefined })]} />)
    expect(screen.getByText('In Stock')).toBeInTheDocument()
  })

  // ── Vendor handling ────────────────────────────────────────────────
  it('renders vendor name', () => {
    render(<CatalogGrid items={[buildItem({ vendor: 'Acme Corp' })]} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('shows fallback for missing vendor', () => {
    render(<CatalogGrid items={[buildItem({ vendor: null })]} />)
    // safeString(null) returns '—'
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  // ── Category ───────────────────────────────────────────────────────
  it('renders category chip when category is provided', () => {
    render(<CatalogGrid items={[buildItem({ category: 'Office Supplies' })]} />)
    expect(screen.getByText('Office Supplies')).toBeInTheDocument()
  })

  it('does not render category chip when category is missing', () => {
    render(<CatalogGrid items={[buildItem({ category: null })]} />)
    // Should show the name and vendor but no category chip
    expect(screen.queryByText('Office Supplies')).not.toBeInTheDocument()
  })

  // ── Lead days ──────────────────────────────────────────────────────
  it('shows lead days when provided', () => {
    render(<CatalogGrid items={[buildItem({ leadDays: 5 })]} />)
    expect(screen.getByText('5 days')).toBeInTheDocument()
  })

  it('shows "Today" for leadDays=0', () => {
    render(<CatalogGrid items={[buildItem({ leadDays: 0 })]} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('does not show lead time when leadDays is null', () => {
    render(<CatalogGrid items={[buildItem({ leadDays: null })]} />)
    expect(screen.queryByText('days')).not.toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })

  // ── Description ────────────────────────────────────────────────────
  it('renders description when provided', () => {
    render(<CatalogGrid items={[buildItem({ description: 'High quality product' })]} />)
    expect(screen.getByText('High quality product')).toBeInTheDocument()
  })

  it('does not render description when null', () => {
    render(<CatalogGrid items={[buildItem({ description: null })]} />)
    expect(screen.queryByText('High quality product')).not.toBeInTheDocument()
  })

  // ── Long text ──────────────────────────────────────────────────────
  it('truncates long product names with line-clamp', () => {
    const longName = 'A'.repeat(200)
    const { container } = render(<CatalogGrid items={[buildItem({ name: longName })]} />)
    const titleEl = container.querySelector('.line-clamp-2')
    expect(titleEl).toBeInTheDocument()
    expect(titleEl?.textContent).toBe(longName)
  })

  // ── Item name fallback ─────────────────────────────────────────────
  it('shows fallback for missing item name', () => {
    render(<CatalogGrid items={[buildItem({ name: null as unknown as string })]} />)
    expect(screen.getByText('Unnamed Product')).toBeInTheDocument()
  })

  // ── onAddToPR callback ─────────────────────────────────────────────
  it('calls onAddToPR with the item when "Add to PR" is clicked', () => {
    const onAddToPR = vi.fn()
    const item = buildItem({ id: 'click-test', name: 'Clickable' })
    render(<CatalogGrid items={[item]} onAddToPR={onAddToPR} />)
    fireEvent.click(screen.getByText('Add to PR'))
    expect(onAddToPR).toHaveBeenCalledWith(item)
  })

  // ── Accessible markup ──────────────────────────────────────────────
  it('has role="list" on the grid container', () => {
    render(<CatalogGrid items={[buildItem()]} />)
    expect(screen.getByTestId('catalog-grid')).toHaveAttribute('role', 'list')
  })

  it('has role="listitem" on each card', () => {
    render(<CatalogGrid items={[buildItem()]} />)
    expect(screen.getByTestId('catalog-item')).toHaveAttribute('role', 'listitem')
  })

  it('loading skeleton has role="status" and aria-label', () => {
    render(<CatalogGrid loading />)
    const skeleton = screen.getByTestId('catalog-skeleton')
    expect(skeleton).toHaveAttribute('role', 'status')
    expect(skeleton).toHaveAttribute('aria-label', 'Loading products')
  })

  it('add-to-PR button has accessible aria-label for in-stock items', () => {
    render(<CatalogGrid items={[buildItem({ id: '1', name: 'Office Chair' })]} />)
    // item.id='1' → data-testid="add-to-pr-btn-1" (safeString uses the id directly, not the fallback)
    const btn = screen.getByTestId('add-to-pr-btn-1')
    expect(btn).toHaveAttribute('aria-label', 'Add Office Chair to purchase request')
  })

  it('add-to-PR button has accessible aria-label for out-of-stock items', () => {
    render(<CatalogGrid items={[buildItem({ id: '1', name: 'Office Chair', inStock: false })]} />)
    const btn = screen.getByTestId('add-to-pr-btn-1')
    expect(btn).toHaveAttribute('aria-label', 'Unavailable: Office Chair')
  })
})
