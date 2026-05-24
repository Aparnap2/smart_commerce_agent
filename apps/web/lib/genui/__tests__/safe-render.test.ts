/**
 * Unit tests for safe-render utilities
 *
 * Tests every edge case: null/undefined/NaN/Infinity/invalid values.
 */

import { describe, it, expect } from 'vitest'
import {
  safePrice,
  safeString,
  safePercent,
  safeArray,
  safeDate,
  formatIndian,
  safeNumber,
  pickFirst,
} from '../safe-render'

// ---------------------------------------------------------------------------
// safePrice
// ---------------------------------------------------------------------------
describe('safePrice', () => {
  it('formats valid paise values correctly', () => {
    expect(safePrice(149999)).toBe('₹1,499.99')
    expect(safePrice(100)).toBe('₹1')
    expect(safePrice(0)).toBe('₹0')
    expect(safePrice(5000000)).toBe('₹50,000')
  })

  it('returns "Price on request" for null', () => {
    expect(safePrice(null)).toBe('Price on request')
  })

  it('returns "Price on request" for undefined', () => {
    expect(safePrice(undefined)).toBe('Price on request')
  })

  it('returns "Price on request" for NaN', () => {
    expect(safePrice(NaN)).toBe('Price on request')
  })

  it('returns "Price on request" for Infinity', () => {
    expect(safePrice(Infinity)).toBe('Price on request')
  })

  it('returns "Price on request" for -Infinity', () => {
    expect(safePrice(-Infinity)).toBe('Price on request')
  })

  it('handles string numbers', () => {
    expect(safePrice('149999')).toBe('₹1,499.99')
  })

  it('handles very large numbers without crashing', () => {
    const result = safePrice(999999999999)
    expect(result).toContain('₹')
    expect(result).not.toContain('NaN')
  })
})

// ---------------------------------------------------------------------------
// safeString
// ---------------------------------------------------------------------------
describe('safeString', () => {
  it('returns the string for valid input', () => {
    expect(safeString('hello')).toBe('hello')
  })

  it('returns fallback for null', () => {
    expect(safeString(null)).toBe('—')
  })

  it('returns fallback for undefined', () => {
    expect(safeString(undefined)).toBe('—')
  })

  it('returns fallback for empty string', () => {
    expect(safeString('')).toBe('—')
  })

  it('returns fallback for whitespace-only string', () => {
    expect(safeString('   ')).toBe('—')
  })

  it('returns custom fallback', () => {
    expect(safeString(null, 'N/A')).toBe('N/A')
    expect(safeString(undefined, 'Default')).toBe('Default')
    expect(safeString('', 'Empty')).toBe('Empty')
  })

  it('handles number input', () => {
    expect(safeString(42)).toBe('—')
  })

  it('handles object input', () => {
    expect(safeString({ name: 'test' })).toBe('—')
  })

  it('handles boolean input', () => {
    expect(safeString(true)).toBe('—')
  })

  it('trims whitespace when checking', () => {
    expect(safeString('  hello  ')).toBe('  hello  ')
    // Note: the function checks val.trim() before returning — so trimmed content passes
  })
})

// ---------------------------------------------------------------------------
// safePercent
// ---------------------------------------------------------------------------
describe('safePercent', () => {
  it('returns the value for valid input (0-100)', () => {
    expect(safePercent(75)).toBe(75)
    expect(safePercent(0)).toBe(0)
    expect(safePercent(100)).toBe(100)
    expect(safePercent(50.5)).toBe(50.5)
  })

  it('clamps values above 100', () => {
    expect(safePercent(150)).toBe(100)
    expect(safePercent(999)).toBe(100)
  })

  it('returns 0 for negative values', () => {
    expect(safePercent(-10)).toBe(0)
    expect(safePercent(-0.5)).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(safePercent(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(safePercent(undefined)).toBe(0)
  })

  it('returns 0 for NaN', () => {
    expect(safePercent(NaN)).toBe(0)
  })

  it('returns 0 for Infinity (not finite)', () => {
    expect(safePercent(Infinity)).toBe(0)
  })

  it('returns 0 for string input', () => {
    expect(safePercent('abc')).toBe(0)
  })

  it('handles string numbers', () => {
    expect(safePercent('75')).toBe(75)
  })
})

// ---------------------------------------------------------------------------
// safeArray
// ---------------------------------------------------------------------------
describe('safeArray', () => {
  it('returns the array for valid array input', () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('returns empty array for null', () => {
    expect(safeArray(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(safeArray(undefined)).toEqual([])
  })

  it('returns empty array for string', () => {
    expect(safeArray('hello')).toEqual([])
  })

  it('returns empty array for object', () => {
    expect(safeArray({ a: 1 })).toEqual([])
  })

  it('returns empty array for number', () => {
    expect(safeArray(42)).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(safeArray([])).toEqual([])
  })

  it('preserves array type with generics', () => {
    const result = safeArray<number>([1, 2, 3])
    expect(result).toEqual([1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// safeDate
// ---------------------------------------------------------------------------
describe('safeDate', () => {
  it('formats valid ISO date strings', () => {
    const result = safeDate('2024-03-15T10:30:00Z')
    expect(result).toBe('15 Mar 2024')
  })

  it('returns fallback for null', () => {
    expect(safeDate(null)).toBe('—')
  })

  it('returns fallback for undefined', () => {
    expect(safeDate(undefined)).toBe('—')
  })

  it('returns fallback for empty string', () => {
    expect(safeDate('')).toBe('—')
  })

  it('returns fallback for invalid date string', () => {
    expect(safeDate('not-a-date')).toBe('—')
  })

  it('returns custom fallback', () => {
    expect(safeDate(null, 'No date')).toBe('No date')
  })

  it('handles epoch timestamps', () => {
    const d = new Date('2024-06-01T00:00:00Z').toISOString()
    const result = safeDate(d)
    expect(result).toBe('01 Jun 2024')
  })

  it('uses en-IN locale formatting', () => {
    const result = safeDate('2024-01-01T00:00:00Z')
    // en-IN format (jsdom/node): "01 Jan 2024"
    expect(result).toMatch(/\d{2} \w{3} \d{4}/)
  })
})

// ---------------------------------------------------------------------------
// formatIndian
// ---------------------------------------------------------------------------
describe('formatIndian', () => {
  it('formats small numbers', () => {
    expect(formatIndian(1000)).toBe('1,000')
  })

  it('formats lakhs', () => {
    expect(formatIndian(150000)).toBe('1,50,000')
  })

  it('formats crores', () => {
    expect(formatIndian(15000000)).toBe('1,50,00,000')
  })

  it('returns "0" for null (Number(null) = 0, which is finite)', () => {
    expect(formatIndian(null)).toBe('0')
  })

  it('returns fallback for undefined', () => {
    expect(formatIndian(undefined)).toBe('—')
  })

  it('returns fallback for NaN', () => {
    expect(formatIndian(NaN)).toBe('—')
  })

  it('returns fallback for Infinity', () => {
    expect(formatIndian(Infinity)).toBe('—')
  })

  it('returns fallback for string that is not a number', () => {
    expect(formatIndian('abc')).toBe('—')
  })

  it('handles string numbers', () => {
    expect(formatIndian('150000')).toBe('1,50,000')
  })

  it('handles 0', () => {
    expect(formatIndian(0)).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// safeNumber
// ---------------------------------------------------------------------------
describe('safeNumber', () => {
  it('returns the number for valid numeric input', () => {
    expect(safeNumber(42)).toBe(42)
    expect(safeNumber(0)).toBe(0)
    expect(safeNumber(-5)).toBe(-5)
  })

  it('returns fallback for null', () => {
    expect(safeNumber(null)).toBe(0)
  })

  it('returns fallback for undefined', () => {
    expect(safeNumber(undefined)).toBe(0)
  })

  it('returns custom fallback', () => {
    expect(safeNumber(null, -1)).toBe(-1)
    expect(safeNumber(undefined, 100)).toBe(100)
  })

  it('returns fallback for NaN', () => {
    expect(safeNumber(NaN)).toBe(0)
  })

  it('returns fallback for Infinity', () => {
    expect(safeNumber(Infinity)).toBe(0)
  })

  it('converts string numbers', () => {
    expect(safeNumber('42')).toBe(42)
  })

  it('returns fallback for non-numeric strings', () => {
    expect(safeNumber('abc')).toBe(0)
  })

  it('handles objects', () => {
    expect(safeNumber({})).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// pickFirst
// ---------------------------------------------------------------------------
describe('pickFirst', () => {
  it('returns the first non-null value', () => {
    expect(pickFirst(null, 'hello')).toBe('hello')
  })

  it('returns the first non-undefined value', () => {
    expect(pickFirst(undefined, 42)).toBe(42)
  })

  it('returns the first value if it is valid', () => {
    expect(pickFirst('first', 'second')).toBe('first')
  })

  it('returns undefined if all values are null/undefined', () => {
    expect(pickFirst(null, undefined)).toBeUndefined()
  })

  it('works with zero (falsy but not null)', () => {
    expect(pickFirst<number | null>(0, null, 42)).toBe(0)
  })

  it('works with empty string', () => {
    expect(pickFirst<string | null>('', null, 'fallback')).toBe('')
  })
})
