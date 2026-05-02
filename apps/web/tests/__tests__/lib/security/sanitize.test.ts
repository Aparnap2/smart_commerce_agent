import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeEmail, sanitizeUrl, sanitizeInput, stripHtml } from '@/lib/security/sanitize'

describe('sanitize', () => {
  describe('sanitizeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('escapes ampersands', () => {
      expect(sanitizeHtml('A & B')).toBe('A &amp; B')
    })

    it('passes through plain text', () => {
      expect(sanitizeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('sanitizeEmail', () => {
    it('lowercases and trims email', () => {
      expect(sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
    })

    it('throws on invalid email', () => {
      expect(() => sanitizeEmail('not-an-email')).toThrow()
    })
  })

  describe('sanitizeUrl', () => {
    it('allows safe protocols', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/')
    })

    it('rejects javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    })
  })

  describe('sanitizeInput', () => {
    it('trims and escapes HTML', () => {
      expect(sanitizeInput('  <b>test</b>  ')).toBe('&lt;b&gt;test&lt;/b&gt;')
    })

    it('returns empty string for whitespace-only', () => {
      expect(sanitizeInput('   ')).toBe('')
    })
  })

  describe('stripHtml', () => {
    it('removes all HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World')
    })
  })
})
