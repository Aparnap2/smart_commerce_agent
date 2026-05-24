// PriceComparisonCard — GenUI component for vendor vs. market price comparison
//
// Renders when the agent emits a __ui__ payload with name: "price-comparison".
// Shows catalog/vendor price alongside real-time market prices from retailers
// so employees can make informed procurement decisions.
//
// States: loading | error | empty | populated
// Edge cases: missing catalogPrice, empty results, null/zero prices,
//   missing ratings, missing thumbnails, long names, all-zero prices,
//   missing source names.

'use client'

import React, { type FC, useMemo } from 'react'
import { safeString, safePrice, safeArray, safeNumber } from '@/lib/genui/safe-render'
import type { PriceComparisonProps } from '@/lib/ui-event-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceComparisonCardProps extends PriceComparisonProps {
  loading?: boolean
  error?: string | null
  /** Fired when a user clicks a "View" link for a retailer */
  onRetailerClick?: (url: string) => void
}

// ---------------------------------------------------------------------------
// Colour-coding helpers
//
//   green  → vendor ≤ market average
//   yellow → vendor < 10 % above market average
//   red    → vendor ≥ 10 % above market average
// ---------------------------------------------------------------------------

type PriceLevel = 'green' | 'yellow' | 'red'

function getPriceLevel(
  catalogPaise: number | null | undefined,
  avgPaise: number,
): PriceLevel | null {
  if (catalogPaise == null || avgPaise <= 0) return null
  if (catalogPaise <= avgPaise) return 'green'
  if (catalogPaise < avgPaise * 1.1) return 'yellow'
  return 'red'
}

function getLevelConfig(level: PriceLevel | null) {
  switch (level) {
    case 'green':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
        label: 'At or below market average',
      }
    case 'yellow':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        ),
        label: 'Slightly above market average',
      }
    case 'red':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        ),
        label: 'Significantly above market average',
      }
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: null,
        label: '',
      }
  }
}

function getPercentDiff(
  catalogPaise: number | null | undefined,
  avgPaise: number,
): number | null {
  if (catalogPaise == null || avgPaise <= 0) return null
  return Math.round(((catalogPaise - avgPaise) / avgPaise) * 100)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton shown while market data is being fetched */
const LoadingSkeleton: FC = () => (
  <div
    data-testid="price-comp-skeleton"
    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    role="status"
    aria-label="Loading price comparison"
  >
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="h-5 bg-gray-100 rounded w-2/3" />
      {/* Comparison columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 bg-gray-100 rounded-lg" />
        <div className="h-28 bg-gray-100 rounded-lg" />
      </div>
      {/* Table rows */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded w-full" />
        ))}
      </div>
      {/* Footer */}
      <div className="h-4 bg-gray-100 rounded w-4/5" />
    </div>
  </div>
)

/** Shown when the market search failed */
const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div
    data-testid="price-comp-error"
    className="flex flex-col items-center justify-center py-10 text-center px-4 bg-white rounded-xl border border-red-200"
  >
    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
      </svg>
    </div>
    <p className="text-gray-700 font-medium">Unable to load price comparison</p>
    <p className="text-gray-400 text-sm mt-1 max-w-xs">{message}</p>
  </div>
)

/** Shown when no market results were returned */
const EmptyState: FC = () => (
  <div
    data-testid="price-comp-empty"
    className="flex flex-col items-center justify-center py-10 text-center px-4 bg-white rounded-xl border border-gray-200"
  >
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <p className="text-gray-500 font-medium">No market data found</p>
    <p className="text-gray-400 text-sm mt-1">Could not find retail prices for this item</p>
  </div>
)

/** Small placeholder icon for items without a thumbnail */
const ProductPlaceholder: FC = () => (
  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  </div>
)

/** External link icon */
const ExternalLinkIcon: FC = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
)

/** Info icon used in the footer disclaimer */
const InfoIcon: FC = () => (
  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const PriceComparisonCard: FC<PriceComparisonCardProps> = ({
  query,
  catalogPrice,
  catalogSource,
  results,
  loading = false,
  error = null,
  onRetailerClick,
}) => {
  // ── Data preparation ──────────────────────────────────────────────────
  const safeResults = useMemo(() => safeArray(results), [results])

  // Prices in the results are treated as integer rupees (same convention as
  // CatalogGrid). Multiply by 100 before passing to safePrice which expects
  // paise. The catalogPrice is already in paise per the prop contract.
  const validPrices = useMemo(
    () => safeResults.filter((r) => r.price != null && r.price > 0).map((r) => r.price),
    [safeResults],
  )

  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0
  const avgPrice =
    validPrices.length > 0
      ? Math.round(validPrices.reduce((s, p) => s + p, 0) / validPrices.length)
      : 0

  const hasValidMarketData = validPrices.length > 0
  const hasCatalogPrice = catalogPrice != null && catalogPrice > 0

  // Colour‑coding: convert market avg from rupees → paise for comparison
  const avgPaise = avgPrice * 100
  const level = getPriceLevel(hasCatalogPrice ? catalogPrice : null, avgPaise)
  const levelConfig = getLevelConfig(level)
  const percentDiff = getPercentDiff(hasCatalogPrice ? catalogPrice : null, avgPaise)

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Empty ─────────────────────────────────────────────────────────────
  if (safeResults.length === 0) return <EmptyState />

  // ── Populated ─────────────────────────────────────────────────────────
  return (
    <div
      data-testid="price-comparison-card"
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      role="region"
      aria-label={`Price comparison for ${safeString(query, 'item')}`}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-lg leading-none" aria-hidden="true">🔍</span>
        <h3 className="font-semibold text-gray-900 text-sm">
          Price Comparison: {safeString(query, 'Unknown item')}
        </h3>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="p-4">
        {/* ── Comparison columns ─────────────────────────────────────── */}
        {(hasCatalogPrice || hasValidMarketData) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Vendor column */}
            {hasCatalogPrice && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                  Vendor Price
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {safePrice(catalogPrice)}
                </p>
                <p className="text-sm text-indigo-600 mt-0.5 truncate">
                  {safeString(catalogSource, 'Approved Vendor')}
                </p>
              </div>
            )}

            {/* Market range column */}
            {hasValidMarketData && (
              <div className={`rounded-lg border p-4 ${levelConfig.bg} ${levelConfig.border}`}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Market Range
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {safePrice(minPrice * 100)}
                  <span className="text-gray-400 mx-1">–</span>
                  {safePrice(maxPrice * 100)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Avg: {safePrice(avgPrice * 100)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Price-level badge ──────────────────────────────────────── */}
        {hasCatalogPrice && hasValidMarketData && level && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 text-sm ${levelConfig.bg} ${levelConfig.border} ${levelConfig.text}`}
            role="status"
            aria-label={`Price level: ${levelConfig.label}${percentDiff != null && percentDiff > 0 ? `, ${percentDiff} percent above average` : ''}`}
          >
            {levelConfig.icon}
            <span>
              {levelConfig.label}
              {percentDiff != null && percentDiff > 0 && (
                <> — You&apos;re paying {percentDiff}% above market avg</>
              )}
            </span>
          </div>
        )}

        {/* ── Retailer table ─────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm" role="table" aria-label="Retailer prices">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-2 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Retailer
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Price
                </th>
                <th className="text-center py-2 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">
                  Rating
                </th>
                <th className="text-right py-2 pl-2 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {safeResults.map((result, index) => {
                const retailerName = safeString(result.source, 'Unknown retailer')
                const productName = safeString(result.title, 'Unknown product')
                const hasPrice = result.price != null && result.price > 0
                const retailerLink = safeString(result.link, '')

                return (
                  <tr
                    key={`retailer-${index}`}
                    className="hover:bg-gray-50 transition-colors"
                    data-testid={`retailer-row-${index}`}
                  >
                    {/* Product info */}
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {result.thumbnail ? (
                          <img
                            src={result.thumbnail}
                            alt=""
                            className="w-8 h-8 rounded object-cover shrink-0 bg-gray-100"
                            loading="lazy"
                          />
                        ) : (
                          <ProductPlaceholder />
                        )}
                        <div className="min-w-0">
                          <p
                            className="font-medium text-gray-900 truncate max-w-[140px] sm:max-w-[220px]"
                            title={productName}
                          >
                            {productName}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-[180px]">
                            {retailerName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-2 text-right whitespace-nowrap align-middle">
                      {hasPrice ? (
                        <span className="font-semibold text-gray-900">
                          {safePrice(result.price! * 100)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Price unavailable</span>
                      )}
                    </td>

                    {/* Rating (desktop only) */}
                    <td className="py-3 px-2 text-center whitespace-nowrap align-middle hidden sm:table-cell">
                      {result.rating != null && result.rating > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-gray-600"
                          aria-label={`${result.rating} out of 5 stars`}
                        >
                          <span className="text-amber-400" aria-hidden="true">⭐</span>
                          {result.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs" aria-label="No rating available">
                          —
                        </span>
                      )}
                    </td>

                    {/* Link */}
                    <td className="py-3 pl-2 text-right align-middle">
                      {retailerLink ? (
                        <a
                          href={retailerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onRetailerClick?.(retailerLink)}
                          aria-label={`View ${retailerName} listing for ${productName}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200 transition-colors"
                        >
                          View
                          <ExternalLinkIcon />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs" aria-label="No link available">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer disclaimer ──────────────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex items-start gap-1.5">
            <InfoIcon />
            <span>
              Items can only be ordered from approved vendors. Use market data for reference.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default PriceComparisonCard
