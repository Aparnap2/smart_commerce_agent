/**
 * Safe rendering utilities for GenUI components
 *
 * Every utility is null-safe and handles edge cases
 * to prevent runtime crashes from malformed SSE data.
 *
 * @module safe-render
 */

/**
 * Convert paise (integer cents) to formatted INR string.
 * Falls back to "Price on request" for null/undefined/NaN/infinity.
 *
 * @example
 *   safePrice(149999)  // "₹1,499.99"
 *   safePrice(null)    // "Price on request"
 *   safePrice(0)       // "₹0.00"
 */
export const safePrice = (paise: unknown): string => {
  if (paise === null || paise === undefined) return 'Price on request'
  const n = Number(paise)
  if (!Number.isFinite(n)) return 'Price on request'
  return `₹${(n / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/**
 * Safe string value with configurable fallback.
 * Returns the fallback for non-strings, empty strings, or whitespace-only strings.
 *
 * @example
 *   safeString("hello")     // "hello"
 *   safeString(null)        // "—"
 *   safeString("", "N/A")   // "N/A"
 */
export const safeString = (val: unknown, fallback = '—'): string =>
  typeof val === 'string' && val.trim() ? val : fallback

/**
 * Parse and clamp a percentage value between 0 and 100.
 * Returns 0 for null/undefined/NaN/negative, 100 for values > 100.
 *
 * @example
 *   safePercent(75)      // 75
 *   safePercent(null)    // 0
 *   safePercent(150)     // 100
 *   safePercent(-10)     // 0
 */
export const safePercent = (val: unknown): number => {
  const n = Number(val)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

/**
 * Safely coerce an unknown value to an array.
 * Returns the value if it is an array, otherwise an empty array.
 *
 * @example
 *   safeArray([1,2,3])    // [1,2,3]
 *   safeArray(null)       // []
 *   safeArray("foo")      // []
 */
export const safeArray = <T>(val: unknown): T[] => (Array.isArray(val) ? val : [])

/**
 * Safely format a date string with Indian locale formatting.
 * Returns fallback for null/undefined/invalid dates.
 *
 * @example
 *   safeDate("2024-03-15T10:30:00Z")  // "15 Mar, 2024"
 *   safeDate(null)                     // "—"
 *   safeDate("invalid")                // "—"
 */
export const safeDate = (val: unknown, fallback = '—'): string => {
  if (!val) return fallback
  try {
    const d = new Date(String(val))
    if (isNaN(d.getTime())) return fallback
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return fallback
  }
}

/**
 * Format a number using Indian numbering system (lakhs, crores).
 * Returns fallback for non-numeric values.
 *
 * @example
 *   formatIndian(1500000)  // "15,00,000"
 *   formatIndian(null)     // "—"
 */
export const formatIndian = (val: unknown): string => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN')
}

/**
 * Safely coerce a value to a number with fallback.
 *
 * @example
 *   safeNumber(42)         // 42
 *   safeNumber("42")       // 42
 *   safeNumber(null, 0)    // 0
 *   safeNumber(undefined)  // 0
 */
export const safeNumber = (val: unknown, fallback = 0): number => {
  if (val === null || val === undefined) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Helper to pick the first non-null, non-undefined value from a list.
 * Useful for components that accept multiple prop aliases.
 *
 * @example
 *   pickFirst(totalBudget, total, 0)  // first truthy value
 */
export const pickFirst = <T>(...args: T[]): T | undefined =>
  args.find((a) => a !== null && a !== undefined)
