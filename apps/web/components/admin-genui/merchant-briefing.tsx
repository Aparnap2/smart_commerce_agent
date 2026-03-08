"use client";

/**
 * Merchant Briefing Component - Business Health Dashboard Card
 *
 * Displays proactive business health analysis with anomaly detection.
 * Shows metrics grid, priority alerts, and action buttons.
 *
 * Design principles:
 * - Intentional minimalism: every element has purpose
 * - Severity-based visual hierarchy (red = high, amber = medium)
 * - Actionable insights with clear next steps
 *
 * @file apps/web/components/admin-genui/merchant-briefing.tsx
 */

import React from "react";
import type { Anomaly } from "@/lib/agent/tools/merchant-briefing";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Revenue metrics from getRevenueDelta query
 */
interface RevenueDelta {
  today: number;
  yesterday: number;
  deltaPercent: number;
  isPositive: boolean;
}

/**
 * Stock velocity item from getStockVelocity query
 */
interface StockVelocityItem {
  productId: string;
  name: string;
  stock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  isLowStock: boolean;
  isUrgent: boolean;
}

/**
 * Refund rate metrics from getRefundRate query
 */
interface RefundRate {
  today: number;
  total: number;
  ratePercent: number;
  avgRatePercent: number;
  isAboveAvg: boolean;
}

/**
 * Cart abandonment metrics from getCartAbandonmentRate query
 */
interface CartAbandonment {
  abandoned: number;
  checkouts: number;
  ratePercent: number;
  isUnusual: boolean;
}

/**
 * Search zero results from getSearchZeroResults query
 */
interface SearchZeroResults {
  terms: string[];
  total: number;
}

/**
 * MerchantBriefing component props
 */
interface MerchantBriefingProps {
  revenueDelta: RevenueDelta;
  stockVelocity: StockVelocityItem[];
  refundRate: RefundRate;
  cartAbandonment: CartAbandonment;
  searchZeroResults: SearchZeroResults;
  anomalies: Anomaly[];
  /** Compact summary for AIState (~100 tokens) */
  summary?: string;
}

// ============================================================================
// Merchant Briefing Component
// ============================================================================

/**
 * Merchant Briefing Card - Proactive Business Health Display
 *
 * Renders a comprehensive business health dashboard card with:
 * - Header with personalized greeting
 * - High priority anomalies (red background)
 * - Medium priority anomalies (amber background)
 * - 4-column metrics grid (revenue, refunds, abandonment, stock)
 * - Action buttons for investigation and full report
 *
 * @param props - Component props with all metrics and anomalies
 * @returns React JSX element for merchant briefing card
 *
 * @example
 * ```tsx
 * <MerchantBriefing
 *   revenueDelta={{ today: 50000, yesterday: 45000, deltaPercent: 11, isPositive: true }}
 *   stockVelocity={[{ productId: "123", name: "Widget", stock: 5, ... }]}
 *   refundRate={{ today: 5, total: 50, ratePercent: 10, avgRatePercent: 7.5, isAboveAvg: true }}
 *   cartAbandonment={{ abandoned: 45, checkouts: 15, ratePercent: 75, isUnusual: false }}
 *   searchZeroResults={{ terms: [], total: 0 }}
 *   anomalies={[{ type: 'revenue', severity: 'high', message: '...', action: 'investigate' }]}
 * />
 * ```
 */
export function MerchantBriefing({
  revenueDelta,
  stockVelocity,
  refundRate,
  cartAbandonment,
  searchZeroResults,
  anomalies,
  summary,
}: MerchantBriefingProps) {
  const highSeverity = anomalies.filter((a) => a.severity === "high");
  const mediumSeverity = anomalies.filter((a) => a.severity === "medium");
  const lowSeverity = anomalies.filter((a) => a.severity === "low");

  const urgentStockCount = stockVelocity.filter((s) => s.isUrgent).length;
  const lowStockCount = stockVelocity.length;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Good morning. Here's what needs your attention:
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Business health briefing • Updated just now
        </p>
      </div>

      {/* High Priority Anomalies */}
      {highSeverity.length > 0 && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-red-50 dark:bg-red-900/10">
          <h4 className="font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
            <span>⚠️</span> High Priority ({highSeverity.length})
          </h4>
          <ul className="space-y-2">
            {highSeverity.map((anomaly, i) => (
              <li
                key={i}
                className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2"
              >
                <span className="mt-1">•</span>
                <span>{anomaly.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Medium Priority Anomalies */}
      {mediumSeverity.length > 0 && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-amber-50 dark:bg-amber-900/10">
          <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
            <span>⚠️</span> Medium Priority ({mediumSeverity.length})
          </h4>
          <ul className="space-y-2">
            {mediumSeverity.map((anomaly, i) => (
              <li
                key={i}
                className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2"
              >
                <span className="mt-1">•</span>
                <span>{anomaly.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Low Priority Anomalies */}
      {lowSeverity.length > 0 && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-700/50">
          <h4 className="font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
            <span>ℹ️</span> Low Priority ({lowSeverity.length})
          </h4>
          <ul className="space-y-2">
            {lowSeverity.map((anomaly, i) => (
              <li
                key={i}
                className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2"
              >
                <span className="mt-1">•</span>
                <span>{anomaly.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {/* Revenue */}
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Revenue</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            ₹{revenueDelta.today.toLocaleString("en-IN")}
          </p>
          <p
            className={`text-xs flex items-center gap-1 ${revenueDelta.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            <span>{revenueDelta.isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(revenueDelta.deltaPercent)}% vs yesterday</span>
          </p>
        </div>

        {/* Refunds */}
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Refunds</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {refundRate.ratePercent}%
          </p>
          <p
            className={`text-xs ${refundRate.isAboveAvg ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
          >
            vs {refundRate.avgRatePercent}% average
          </p>
        </div>

        {/* Cart Abandonment */}
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Cart Abandonment
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {cartAbandonment.ratePercent}%
          </p>
          <p
            className={`text-xs ${cartAbandonment.isUnusual ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
          >
            last 4 hours
          </p>
        </div>

        {/* Low Stock */}
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Low Stock Items
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {lowStockCount}
          </p>
          <p
            className={`text-xs ${urgentStockCount > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
          >
            {urgentStockCount} urgent
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 grid grid-cols-2 gap-2">
        <button
          className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          type="button"
        >
          Investigate
        </button>
        <button
          className="px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          type="button"
        >
          View Full Report
        </button>
      </div>
    </div>
  );
}

export default MerchantBriefing;
