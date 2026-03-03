/**
 * Schema Validator
 *
 * Protocol validation helpers for Schema.org commerce data.
 * Provides validation, sanitization, and security checking for
 * commerce-related data structures.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type {
  Product,
  Order,
  Refund,
  SupportTicket,
  ShoppingCart,
} from './commerce';
import {
  ProductSchema,
  OrderSchema,
  RefundSchema,
  SupportTicketSchema,
  ShoppingCartSchema,
} from './commerce';

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result with detailed feedback
 */
export interface ValidationResult<T = unknown> {
  /** Whether validation passed */
  valid: boolean;
  /** The validated/parsed data (if valid) */
  data?: T;
  /** Validation errors */
  errors: ValidationError[];
  /** Warnings (non-blocking) */
  warnings: ValidationWarning[];
  /** Schema type validated */
  schemaType: string;
  /** Validation timestamp */
  timestamp: string;
}

/**
 * Individual validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
  value?: unknown;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  REQUIRED = 'REQUIRED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  UNKNOWN_FIELD = 'UNKNOWN_FIELD',
  MALICIOUS_CONTENT = 'MALICIOUS_CONTENT',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',
}

/**
 * Validation warning (non-blocking)
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: ValidationWarningCode;
  suggestion?: string;
}

/**
 * Warning codes
 */
export enum ValidationWarningCode {
  DEPRECATED_FIELD = 'DEPRECATED_FIELD',
  MISSING_RECOMMENDED = 'MISSING_RECOMMENDED',
  PERFORMANCE_CONCERN = 'PERFORMANCE_CONCERN',
  ACCESSIBILITY_ISSUE = 'ACCESSIBILITY_ISSUE',
  SEO_CONCERN = 'SEO_CONCERN',
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize string to prevent XSS and injection attacks
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Sanitize URL to prevent malicious links
 */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value);
    // Block dangerous protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return emailRegex.test(email) ? email : null;
}

/**
 * Sanitize currency amount
 */
export function sanitizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100; // Round to 2 decimal places
  }
  return null;
}

// ============================================================================
// Protocol Validator Class
// ============================================================================

/**
 * Protocol validator for commerce schemas
 */
export class SchemaValidator {
  private strictMode: boolean;

  constructor(options: { strictMode?: boolean } = {}) {
    this.strictMode = options.strictMode ?? false;
  }

  /**
   * Validate a Product schema
   */
  validateProduct(data: unknown): ValidationResult<Product> {
    const result = this.validate(ProductSchema, data, 'Product');
    return result as ValidationResult<Product>;
  }

  /**
   * Validate an Order schema
   */
  validateOrder(data: unknown): ValidationResult<Order> {
    const result = this.validate(OrderSchema, data, 'Order');
    return result as ValidationResult<Order>;
  }

  /**
   * Validate a Refund schema
   */
  validateRefund(data: unknown): ValidationResult<Refund> {
    const result = this.validate(RefundSchema, data, 'Refund');
    return result as ValidationResult<Refund>;
  }

  /**
   * Validate a SupportTicket schema
   */
  validateSupportTicket(data: unknown): ValidationResult<SupportTicket> {
    const result = this.validate(SupportTicketSchema, data, 'SupportTicket');
    return result as ValidationResult<SupportTicket>;
  }

  /**
   * Validate a ShoppingCart schema
   */
  validateShoppingCart(data: unknown): ValidationResult<ShoppingCart> {
    const result = this.validate(ShoppingCartSchema, data, 'ShoppingCart');
    return result as ValidationResult<ShoppingCart>;
  }

  /**
   * Generic schema validation with error handling
   */
  private validate<T>(
    schema: z.ZodType<T>,
    data: unknown,
    schemaType: string
  ): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Sanitize input data
      const sanitized = this.sanitizeInput(data);

      // Validate against schema
      const parsed = schema.parse(sanitized);

      // Run additional security checks
      const securityErrors = this.runSecurityChecks(sanitized);
      errors.push(...securityErrors);

      // Run best practices checks
      const practiceWarnings = this.runBestPracticesChecks(parsed, schemaType);
      warnings.push(...practiceWarnings);

      return {
        valid: errors.length === 0,
        data: parsed,
        errors,
        warnings,
        schemaType,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            code: this.mapZodError(issue),
            value: issue.code === 'custom' ? (issue as any).params?.['value'] ?? undefined : undefined,
          });
        }
      } else {
        errors.push({
          field: '',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: ValidationErrorCode.SCHEMA_VIOLATION,
        });
      }

      return {
        valid: false,
        errors,
        warnings,
        schemaType,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Sanitize input data recursively
   */
  private sanitizeInput(data: unknown): unknown {
    if (typeof data === 'string') {
      return sanitizeString(data);
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        const sanitizedKey = sanitizeString(key);

        // Skip empty keys or keys that became empty after sanitization
        if (!sanitizedKey) continue;

        if (typeof value === 'string') {
          sanitized[sanitizedKey] = sanitizeString(value);
        } else if (Array.isArray(value)) {
          sanitized[sanitizedKey] = value.map((item) => this.sanitizeInput(item));
        } else if (typeof value === 'object' && value !== null) {
          sanitized[sanitizedKey] = this.sanitizeInput(value);
        } else {
          sanitized[sanitizedKey] = value;
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Run security checks on validated data
   */
  private runSecurityChecks(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for potential XSS patterns
    const jsonString = JSON.stringify(data);
    if (/<script|javascript:|data:/i.test(jsonString)) {
      errors.push({
        field: '*',
        message: 'Potential malicious content detected',
        code: ValidationErrorCode.MALICIOUS_CONTENT,
      });
    }

    // Check for SQL injection patterns
    if (/['%27]|["']\s*(?:or|and)\s*["']|UNION\s+SELECT|BENCHMARK\(/i.test(jsonString)) {
      errors.push({
        field: '*',
        message: 'Potential SQL injection pattern detected',
        code: ValidationErrorCode.MALICIOUS_CONTENT,
      });
    }

    return errors;
  }

  /**
   * Run best practices checks
   */
  private runBestPracticesChecks<T>(
    _data: T,
    _schemaType: string
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Schema.org specific checks could go here
    // For example:
    // - Missing image for Product (SEO concern)
    // - Missing aggregate rating for Product (social proof concern)

    return warnings;
  }

  /**
   * Map Zod error to validation error code
   */
  private mapZodError(issue: z.ZodIssue): ValidationErrorCode {
    // Use string comparison for Zod v4 compatibility
    const code: string = issue.code as string;
    switch (code) {
      case 'invalid_type':
        return ValidationErrorCode.TYPE_MISMATCH;
      case 'required':
        return ValidationErrorCode.REQUIRED;
      case 'unrecognized_keys':
        return ValidationErrorCode.UNKNOWN_FIELD;
      case 'too_big':
      case 'too_small':
        return ValidationErrorCode.OUT_OF_RANGE;
      case 'invalid_string':
        return ValidationErrorCode.INVALID_FORMAT;
      default:
        return ValidationErrorCode.SCHEMA_VIOLATION;
    }
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate product and return boolean
 */
export function isValidProduct(data: unknown): data is Product {
  const validator = new SchemaValidator();
  return validator.validateProduct(data).valid;
}

/**
 * Validate order and return boolean
 */
export function isValidOrder(data: unknown): data is Order {
  const validator = new SchemaValidator();
  return validator.validateOrder(data).valid;
}

/**
 * Validate refund and return boolean
 */
export function isValidRefund(data: unknown): data is Refund {
  const validator = new SchemaValidator();
  return validator.validateRefund(data).valid;
}

/**
 * Validate support ticket and return boolean
 */
export function isValidSupportTicket(data: unknown): data is SupportTicket {
  const validator = new SchemaValidator();
  return validator.validateSupportTicket(data).valid;
}

/**
 * Validate shopping cart and return boolean
 */
export function isValidShoppingCart(data: unknown): data is ShoppingCart {
  const validator = new SchemaValidator();
  return validator.validateShoppingCart(data).valid;
}

// ============================================================================
// JSON-LD Utilities
// ============================================================================

/**
 * Extract JSON-LD from HTML or raw string
 */
export function extractJsonLd(jsonLdString: string): unknown {
  try {
    // Handle @type context
    const cleaned = jsonLdString
      .replace(/^[\s\n]*<!DOCTYPE[^>]*>/i, '')
      .replace(/^[\s\n]*<html[^>]*>/i, '')
      .replace(/^[\s\n]*<head[^>]*>/i, '')
      .replace(/^[\s\n]*<\/head>[\s\n]*<body[^>]*>/i, '')
      .replace(/<\/body>[\s\n]*<\/html>[\s\n]*$/i, '')
      .replace(/<script[^>]*type="application\/ld\+json"[^>]*>/i, '')
      .replace(/<\/script>/i, '')
      .trim();

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Serialize data to JSON-LD string
 */
export function toJsonLd<T extends { '@context': string; '@type': string }>(
  data: T,
  options: { pretty?: boolean } = {}
): string {
  const { pretty = true } = options;
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Create JSON-LD script tag
 */
export function toJsonLdScript<T extends { '@context': string; '@type': string }>(
  data: T
): string {
  return `<script type="application/ld+json">${toJsonLd(data)}</script>`;
}

// Export the validator instance
export const validator = new SchemaValidator();
