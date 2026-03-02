/**
 * Input/Output Guardrails for RAG
 *
 * Provides validation for user inputs and AI outputs including:
 * - PII detection
 * - Toxicity detection
 * - Hallucination detection
 * - Jailbreak prevention
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the input/output passed validation */
  valid: boolean;
  /** Validation score (0-1) */
  score: number;
  /** Detected issues */
  issues: string[];
  /** Recommended action */
  action: 'allow' | 'warn' | 'block';
  /** Details about detection */
  details?: Record<string, unknown>;
}

/**
 * Guardrails configuration
 */
export interface GuardrailsConfig {
  /** Enable PII detection */
  enablePIIDetection: boolean;
  /** Enable toxicity detection */
  enableToxicityDetection: boolean;
  /** Enable jailbreak detection */
  enableJailbreakDetection: boolean;
  /** Toxicity threshold (0-1) */
  toxicityThreshold: number;
  /** PII threshold (0-1) */
  piiThreshold: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GuardrailsConfig = {
  enablePIIDetection: true,
  enableToxicityDetection: true,
  enableJailbreakDetection: true,
  toxicityThreshold: 0.7,
  piiThreshold: 0.5,
};

/**
 * Common PII patterns
 */
const PII_PATTERNS: Record<string, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.]?)?\(?(?:[0-9]{3})\)?[-.]?(?:[0-9]{3})[-.]?(?:[0-9]{4})\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  url: /\bhttps?:\/\/[^\s]+\b/g,
};

/**
 * Toxic keywords and patterns
 */
const TOXIC_PATTERNS = [
  /\b(hate|kill|die|suicide|murder|stupid|idiot|dumb|worthless|dumb|moron)\b/gi,
  /\b(hack|crack|exploit|injection)\b/gi,
  /\b(ignore|disregard|forget)\s+(rules|instructions|policy|all)\b/gi,
];

/**
 * Jailbreak attempt patterns
 */
const JAILBREAK_PATTERNS = [
  /ignore (all |previous |the )?(instructions|rules|guidelines|rules)/gi,
  /disregard (all |previous )?(instructions|rules)/gi,
  /you are now (in unrestricted mode|a different ai)/gi,
  /pretend you are (someone else|an ai without restrictions)/gi,
  /what would you do if (there were no rules|you could do anything)/gi,
  /system:|developer:|user:.*\n.*assistant:/gi,
  /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]/gi,
];

/**
 * Detect PII in text
 */
function detectPII(text: string, threshold: number): { detected: boolean; score: number; types: string[] } {
  const types: string[] = [];
  let matchCount = 0;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      types.push(type);
      matchCount += matches.length;
    }
  }

  // Calculate score based on number and type of PII detected
  const score = Math.min(matchCount * 0.4, 1.0);

  return {
    detected: score >= threshold || matchCount > 0,
    score,
    types,
  };
}

/**
 * Detect toxicity in text
 */
function detectToxicity(text: string, threshold: number): { detected: boolean; score: number; patterns: string[] } {
  const patterns: string[] = [];
  let matchCount = 0;

  for (const pattern of TOXIC_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      patterns.push(pattern.source);
      matchCount += matches.length;
    }
  }

  const score = Math.min(matchCount * 0.3, 1.0);

  return {
    detected: score >= threshold,
    score,
    patterns,
  };
}

/**
 * Detect jailbreak attempts
 */
function detectJailbreak(text: string): { detected: boolean; score: number; patterns: string[] } {
  const patterns: string[] = [];
  let matchCount = 0;

  for (const pattern of JAILBREAK_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      patterns.push(pattern.source);
      matchCount++;
    }
  }

  const score = Math.min(matchCount * 0.5, 1.0);

  return {
    detected: score > 0.2, // Lower threshold for jailbreak
    score,
    patterns,
  };
}

/**
 * Validate user input
 *
 * @param input - User input text
 * @param config - Validation configuration
 * @returns Validation result
 */
export function validateInput(
  input: string,
  config: Partial<GuardrailsConfig> = {}
): ValidationResult {
  const fullConfig: GuardrailsConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const issues: string[] = [];
  let overallScore = 0;
  let action: 'allow' | 'warn' | 'block' = 'allow';

  logger.debug('RAG', 'Validating input', {
    inputLength: input.length,
  });

  // PII Detection
  if (fullConfig.enablePIIDetection) {
    const piiResult = detectPII(input, fullConfig.piiThreshold);
    if (piiResult.detected) {
      issues.push(`PII detected: ${piiResult.types.join(', ')}`);
      overallScore = Math.max(overallScore, piiResult.score);
      action = 'warn';
    }
  }

  // Toxicity Detection
  if (fullConfig.enableToxicityDetection) {
    const toxicityResult = detectToxicity(input, fullConfig.toxicityThreshold);
    if (toxicityResult.detected) {
      issues.push(`Toxic content detected`);
      overallScore = Math.max(overallScore, toxicityResult.score);
      action = toxicityResult.score > 0.8 ? 'block' : 'warn';
    }
  }

  // Jailbreak Detection
  if (fullConfig.enableJailbreakDetection) {
    const jailbreakResult = detectJailbreak(input);
    if (jailbreakResult.detected) {
      issues.push('Potential jailbreak attempt detected');
      overallScore = Math.max(overallScore, jailbreakResult.score);
      action = 'block';
    }
  }

  const result: ValidationResult = {
    valid: issues.length === 0,
    score: overallScore,
    issues,
    action,
    details: {
      inputLength: input.length,
      timestamp: Date.now(),
    },
  };

  if (issues.length > 0) {
    logger.warn('RAG', 'Input validation flagged', {
      issues,
      action,
      score: overallScore,
    });
  }

  return result;
}

/**
 * Validate AI output
 *
 * @param output - AI-generated output text
 * @param context - Retrieved context used for generation
 * @param config - Validation configuration
 * @returns Validation result
 */
export function validateOutput(
  output: string,
  context?: string,
  config: Partial<GuardrailsConfig> = {}
): ValidationResult {
  const fullConfig: GuardrailsConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const issues: string[] = [];
  let overallScore = 0;
  let action: 'allow' | 'warn' | 'block' = 'allow';

  logger.debug('RAG', 'Validating output', {
    outputLength: output.length,
  });

  // PII Detection in output
  if (fullConfig.enablePIIDetection) {
    const piiResult = detectPII(output, fullConfig.piiThreshold);
    if (piiResult.detected) {
      issues.push(`PII in output: ${piiResult.types.join(', ')}`);
      overallScore = Math.max(overallScore, piiResult.score);
      action = 'warn';
    }
  }

  // Toxicity Detection in output
  if (fullConfig.enableToxicityDetection) {
    const toxicityResult = detectToxicity(output, fullConfig.toxicityThreshold);
    if (toxicityResult.detected) {
      issues.push(`Toxic content in output`);
      overallScore = Math.max(overallScore, toxicityResult.score);
      action = 'block';
    }
  }

  // Hallucination Detection (if context provided)
  if (context) {
    const hallucinationResult = detectHallucination(output, context);
    if (hallucinationResult.detected) {
      issues.push('Potential hallucination detected');
      overallScore = Math.max(overallScore, hallucinationResult.score);
      action = hallucinationResult.score > 0.7 ? 'warn' : action;
    }
  }

  const result: ValidationResult = {
    valid: issues.length === 0,
    score: overallScore,
    issues,
    action,
    details: {
      outputLength: output.length,
      hasContext: !!context,
      timestamp: Date.now(),
    },
  };

  if (issues.length > 0) {
    logger.warn('RAG', 'Output validation flagged', {
      issues,
      action,
      score: overallScore,
    });
  }

  return result;
}

/**
 * Simple hallucination detection
 * Checks if output contains claims not supported by context
 */
function detectHallucination(
  output: string,
  context: string
): { detected: boolean; score: number } {
  // Extract key claims from output (simplified)
  const outputLower = output.toLowerCase();
  const contextLower = context.toLowerCase();

  // Check for specific numbers/dates in output that aren't in context
  const numberPattern = /\b\d+(\.\d+)?\b/g;
  const outputNumbers = outputLower.match(numberPattern) || [];
  const contextNumbers = new Set(contextLower.match(numberPattern) || []);

  let unmatchedNumbers = 0;
  for (const num of outputNumbers) {
    if (!contextNumbers.has(num)) {
      unmatchedNumbers++;
    }
  }

  // Check for superlatives that might indicate fabrication
  const superlatives = ['best', 'worst', 'only', 'always', 'never', 'guaranteed'];
  let superlativeCount = 0;
  for (const superlative of superlatives) {
    if (outputLower.includes(superlative) && !contextLower.includes(superlative)) {
      superlativeCount++;
    }
  }

  const score = Math.min(
    (unmatchedNumbers * 0.2) + (superlativeCount * 0.15),
    1.0
  );

  return {
    detected: score > 0.5,
    score,
  };
}

/**
 * Sanitize input by removing detected PII
 */
export function sanitizeInput(input: string): string {
  let sanitized = input;

  // Replace email addresses
  sanitized = sanitized.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');

  // Replace phone numbers
  sanitized = sanitized.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');

  // Replace SSNs
  sanitized = sanitized.replace(PII_PATTERNS.ssn, '[REDACTED_SSN]');

  // Replace credit card numbers
  sanitized = sanitized.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');

  // Replace IP addresses
  sanitized = sanitized.replace(PII_PATTERNS.ipAddress, '[REDACTED_IP]');

  return sanitized;
}

/**
 * Guardrails middleware for chat handlers
 */
export function createGuardrailsMiddleware(config: Partial<GuardrailsConfig> = {}) {
  return {
    /**
     * Process incoming message
     */
    async processInput(input: string): Promise<{ allowed: boolean; sanitizedInput: string; reason?: string }> {
      const validation = validateInput(input, config);

      if (validation.action === 'block') {
        return {
          allowed: false,
          sanitizedInput: input,
          reason: validation.issues.join('; '),
        };
      }

      const sanitizedInput = config.enablePIIDetection !== false
        ? sanitizeInput(input)
        : input;

      return {
        allowed: true,
        sanitizedInput,
        reason: validation.issues.length > 0 ? validation.issues.join('; ') : undefined,
      };
    },

    /**
     * Process outgoing response
     */
    async processOutput(
      output: string,
      context?: string
    ): Promise<{ allowed: boolean; output: string; reason?: string }> {
      const validation = validateOutput(output, context, config);

      if (validation.action === 'block') {
        return {
          allowed: false,
          output,
          reason: validation.issues.join('; '),
        };
      }

      return {
        allowed: true,
        output,
        reason: validation.issues.length > 0 ? validation.issues.join('; ') : undefined,
      };
    },
  };
}
