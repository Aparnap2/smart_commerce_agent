// apps/agent/src/evals/metrics.ts
// LLM Evaluation Metrics Engine
// Scores: Tool Selection, Parameter Quality, Hallucination Prevention

import type { EvalCase } from './dataset.js'

export type ToolCall = {
  name: string
  args: Record<string, unknown>
}

export type MetricResult = {
  ok: boolean
  errors: string[]
  details?: Record<string, unknown>
}

export type EvalResult = {
  caseId: string
  input: string
  passed: boolean
  toolSelectionOk: boolean
  paramQualityOk: boolean
  hallucinationOk: boolean
  actualTools: string[]
  actualArgs: Record<string, unknown>[]
  finalResponse: string
  errors: string[]
  durationMs: number
}

export type AggregateScore = {
  overall: { total: number; passed: number; rate: string }
  toolSelection: { passed: number; total: number; rate: string }
  paramQuality: { passed: number; total: number; rate: string }
  hallucination: { passed: number; total: number; rate: string }
  byTag: Record<string, { passed: number; total: number; rate: string }>
  failures: EvalResult[]
}

/**
 * Score tool selection accuracy
 * - Every expected tool must have been called
 * - No forbidden tools must have been called
 */
export function scoreToolSelection(evalCase: EvalCase, actualTools: string[]): MetricResult {
  const errors: string[] = []

  // Every expected tool must have been called
  for (const expected of evalCase.expectedTools) {
    if (!actualTools.includes(expected)) {
      errors.push(`Expected tool "${expected}" was NOT called`)
    }
  }

  // No forbidden tools must have been called
  for (const forbidden of evalCase.forbiddenTools ?? []) {
    if (actualTools.includes(forbidden)) {
      errors.push(`Forbidden tool "${forbidden}" WAS called`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    details: {
      expectedTools: evalCase.expectedTools,
      actualTools,
      forbiddenTools: evalCase.forbiddenTools ?? [],
    },
  }
}

/**
 * Score parameter extraction quality
 * - Exact match for primitive values
 * - Custom matchers for flexible validation (contains_any, contains, number_in_range)
 */
export function scoreParamQuality(evalCase: EvalCase, actualArgs: Record<string, unknown>[]): MetricResult {
  if (!evalCase.expectedArgs) {
    return { ok: true, errors: [], details: {} }
  }

  const errors: string[] = []
  // Merge all tool call args into single object for comparison
  const allArgs: Record<string, unknown> = Object.assign({}, ...actualArgs)

  for (const [key, expected] of Object.entries(evalCase.expectedArgs)) {
    const actual = allArgs[key]

    // Handle custom matchers
    if (typeof expected === 'object' && expected !== null && '__type' in expected) {
      const matcher = expected as { __type: string; [key: string]: unknown }

      if (matcher.__type === 'contains_any') {
        const options = matcher.options as string[]
        const actualStr = String(actual ?? '').toLowerCase()
        const matches = options.some(opt => actualStr.includes(opt.toLowerCase()))
        if (!matches) {
          errors.push(
            `Param "${key}": expected one of [${options.join(', ')}], got "${actual ?? 'undefined'}"`
          )
        }
      } else if (matcher.__type === 'contains') {
        const substring = matcher.substring as string
        const actualStr = String(actual ?? '').toLowerCase()
        if (!actualStr.includes(substring.toLowerCase())) {
          errors.push(
            `Param "${key}": expected to contain "${substring}", got "${actual ?? 'undefined'}"`
          )
        }
      } else if (matcher.__type === 'number_in_range') {
        const min = matcher.min as number
        const max = matcher.max as number
        const actualNum = Number(actual)
        if (isNaN(actualNum) || actualNum < min || actualNum > max) {
          errors.push(
            `Param "${key}": expected number in range [${min}, ${max}], got ${actual ?? 'undefined'}`
          )
        }
      }
    } else {
      // Exact match for primitive values
      if (actual !== expected) {
        errors.push(
          `Param "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual ?? 'undefined')}`
        )
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    details: {
      expectedArgs: evalCase.expectedArgs,
      actualArgs: allArgs,
    },
  }
}

/**
 * Score hallucination prevention
 * - If expected tool WAS called, data came from tools (not hallucination)
 * - If tool NOT called, check if response contains forbidden patterns
 */
export function scoreHallucination(
  evalCase: EvalCase,
  actualTools: string[],
  finalResponse: string
): MetricResult {
  if (!evalCase.expectedNoHallucination) {
    return { ok: true, errors: [], details: {} }
  }

  // If expected tool WAS called, data came from tools — not hallucination
  const toolWasCalled = evalCase.expectedTools.some(t => actualTools.includes(t))
  if (toolWasCalled) {
    return {
      ok: true,
      errors: [],
      details: { toolWasCalled: true, checkedPatterns: evalCase.expectedNoHallucination.forbiddenPatterns.length },
    }
  }

  // Tool NOT called — check if response contains forbidden patterns
  const errors: string[] = []
  const lowerResponse = finalResponse.toLowerCase()

  for (const pattern of evalCase.expectedNoHallucination.forbiddenPatterns) {
    if (lowerResponse.includes(pattern.toLowerCase())) {
      errors.push(`Hallucination: response contains "${pattern}" without calling tool`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    details: {
      toolWasCalled: false,
      responseLength: finalResponse.length,
      checkedPatterns: evalCase.expectedNoHallucination.forbiddenPatterns.length,
      hallucinatedPatterns: errors.map(e => e.match(/"([^"]+)"/)?.[1]).filter(Boolean),
    },
  }
}

/**
 * Aggregate scores across all eval results
 */
export function aggregateScores(results: EvalResult[], allTags: string[]): AggregateScore {
  const total = results.length
  const passed = results.filter(r => r.passed).length

  // Calculate rates by tag
  const byTag: Record<string, { passed: number; total: number; rate: string }> = {}
  for (const tag of allTags) {
    const tagResults = results.filter(r => {
      // We need to track tags in results - for now, use caseId to lookup
      // This is a simplification - in production, tags would be included in EvalResult
      return true // Placeholder
    })
    const tagPassed = tagResults.filter(r => r.passed).length
    byTag[tag] = {
      passed: tagPassed,
      total: tagResults.length,
      rate: tagResults.length > 0 ? ((tagPassed / tagResults.length) * 100).toFixed(1) + '%' : 'N/A',
    }
  }

  return {
    overall: {
      total,
      passed,
      rate: total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%',
    },
    toolSelection: {
      passed: results.filter(r => r.toolSelectionOk).length,
      total,
      rate: total > 0 ? ((results.filter(r => r.toolSelectionOk).length / total) * 100).toFixed(1) + '%' : '0%',
    },
    paramQuality: {
      passed: results.filter(r => r.paramQualityOk).length,
      total,
      rate: total > 0 ? ((results.filter(r => r.paramQualityOk).length / total) * 100).toFixed(1) + '%' : '0%',
    },
    hallucination: {
      passed: results.filter(r => r.hallucinationOk).length,
      total,
      rate: total > 0 ? ((results.filter(r => r.hallucinationOk).length / total) * 100).toFixed(1) + '%' : '0%',
    },
    byTag,
    failures: results.filter(r => !r.passed),
  }
}

/**
 * Format score for display
 */
export function formatScore(passed: number, total: number): string {
  if (total === 0) return '0/0 (N/A)'
  const rate = ((passed / total) * 100).toFixed(1)
  return `${passed}/${total} (${rate}%)`
}

/**
 * Check if scores meet targets
 */
export function meetsTargets(
  scores: AggregateScore | {
    toolSelection: { rate: string }
    paramQuality: { rate: string }
    hallucination: { rate: string }
    overallRate: string
  },
  targets: { toolSelection: number; paramQuality: number; hallucination: number; overall: number }
): { met: boolean; failures: string[] } {
  const failures: string[] = []

  const toolRate = parseFloat(scores.toolSelection.rate)
  if (toolRate < targets.toolSelection) {
    failures.push(`Tool Selection: ${scores.toolSelection.rate} < ${targets.toolSelection}%`)
  }

  const paramRate = parseFloat(scores.paramQuality.rate)
  if (paramRate < targets.paramQuality) {
    failures.push(`Parameter Quality: ${scores.paramQuality.rate} < ${targets.paramQuality}%`)
  }

  const halRate = parseFloat(scores.hallucination.rate)
  if (halRate < targets.hallucination) {
    failures.push(`Hallucination Prevention: ${scores.hallucination.rate} < ${targets.hallucination}%`)
  }

  const overallRate = 'overallRate' in scores ? parseFloat(scores.overallRate) : parseFloat(scores.overall.rate)
  if (overallRate < targets.overall) {
    failures.push(`Overall: ${'overallRate' in scores ? scores.overallRate : scores.overall.rate} < ${targets.overall}%`)
  }

  return { met: failures.length === 0, failures }
}
