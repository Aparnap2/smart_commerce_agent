// apps/agent/src/evals/runner.ts
// LLM Evaluation Runner
// Executes eval cases against the agent graph and scores results

import type { EvalCase } from './dataset.js'
import {
  scoreToolSelection,
  scoreParamQuality,
  scoreHallucination,
  type EvalResult,
  type ToolCall,
} from './metrics.js'

// Type for graph invoke function (LangGraph compiled graph)
export type GraphInvoke = (
  input: { messages: Array<{ role: string; content: string }> },
  config?: { configurable?: { userId?: string; threadId?: string } }
) => Promise<{ messages: Array<{ type?: string; _getType?: () => string; content?: string; tool_calls?: ToolCall[] }> }>

/**
 * Run a single eval case against the agent graph
 */
export async function runEvalCase(
  evalCase: EvalCase,
  graphInvoke: GraphInvoke,
  options?: { userId?: string; timeoutMs?: number }
): Promise<EvalResult> {
  const start = Date.now()
  const errors: string[] = []
  const userId = options?.userId ?? 'eval-user'
  const timeoutMs = options?.timeoutMs ?? 30000

  let actualTools: string[] = []
  let actualArgs: Record<string, unknown>[] = []
  let finalResponse = ''

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    })

    // Invoke the graph
    const invokePromise = graphInvoke(
      { messages: [{ role: 'user', content: evalCase.input }] },
      { configurable: { userId, threadId: `eval-${evalCase.id}` } }
    )

    const result = await Promise.race([invokePromise, timeoutPromise])

    // Extract tool calls and final response from message history
    for (const msg of result.messages ?? []) {
      // Get message type - handle both string type and _getType() method
      const msgType = msg.type ?? (msg._getType ? msg._getType() : null) ?? 'unknown'
      
      // Handle AIMessage with tool_calls
      if (msgType === 'ai' || msgType === 'AIMessage') {
        // Check for tool_calls array
        if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            if (tc.name) {
              actualTools.push(tc.name)
              actualArgs.push(tc.args ?? {})
            }
          }
        }
        
        // Capture final response (AI message without tool calls)
        if (!msg.tool_calls?.length && typeof msg.content === 'string') {
          finalResponse = msg.content
        }
      }
      
      // Handle ToolMessage (result from tool execution)
      if (msgType === 'tool' || msgType === 'ToolMessage') {
        // Tool was called - this is the result
        // We already captured tool info from the AI message
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    errors.push(`Graph error: ${errorMessage}`)
  }

  // Score all three dimensions
  const toolScore = scoreToolSelection(evalCase, actualTools)
  const paramScore = scoreParamQuality(evalCase, actualArgs)
  const halScore = scoreHallucination(evalCase, actualTools, finalResponse)

  // Combine all errors
  const allErrors = [
    ...errors,
    ...toolScore.errors,
    ...paramScore.errors,
    ...halScore.errors,
  ]

  return {
    caseId: evalCase.id,
    input: evalCase.input,
    passed: allErrors.length === 0,
    toolSelectionOk: toolScore.ok,
    paramQualityOk: paramScore.ok,
    hallucinationOk: halScore.ok,
    actualTools,
    actualArgs,
    finalResponse,
    errors: allErrors,
    durationMs: Date.now() - start,
  }
}

/**
 * Run multiple eval cases in parallel with concurrency limit
 */
export async function runEvalBatch(
  cases: EvalCase[],
  graphInvoke: GraphInvoke,
  options?: { userId?: string; concurrency?: number; timeoutMs?: number }
): Promise<EvalResult[]> {
  const concurrency = options?.concurrency ?? 5
  const userId = options?.userId ?? 'eval-user'
  const timeoutMs = options?.timeoutMs ?? 30000

  const results: EvalResult[] = []

  // Process in batches
  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(c => runEvalCase(c, graphInvoke, { userId, timeoutMs }))
    )
    results.push(...batchResults)

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < cases.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Run all eval cases and return aggregated results
 */
export async function runAllEvals(
  graphInvoke: GraphInvoke,
  allCases: EvalCase[],
  options?: { userId?: string; concurrency?: number }
): Promise<{ results: EvalResult[]; summary: EvalSummary }> {
  const start = Date.now()
  const results = await runEvalBatch(allCases, graphInvoke, options)
  const duration = Date.now() - start

  const summary: EvalSummary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    toolSelection: {
      passed: results.filter(r => r.toolSelectionOk).length,
      total: results.length,
      rate: ((results.filter(r => r.toolSelectionOk).length / results.length) * 100).toFixed(1) + '%',
    },
    paramQuality: {
      passed: results.filter(r => r.paramQualityOk).length,
      total: results.length,
      rate: ((results.filter(r => r.paramQualityOk).length / results.length) * 100).toFixed(1) + '%',
    },
    hallucination: {
      passed: results.filter(r => r.hallucinationOk).length,
      total: results.length,
      rate: ((results.filter(r => r.hallucinationOk).length / results.length) * 100).toFixed(1) + '%',
    },
    overallRate: ((results.filter(r => r.passed).length / results.length) * 100).toFixed(1) + '%',
    avgDurationMs: Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length),
    totalDurationMs: duration,
    failures: results.filter(r => !r.passed).map(r => ({
      caseId: r.caseId,
      input: r.input,
      errors: r.errors,
    })),
  }

  return { results, summary }
}

export type EvalSummary = {
  total: number
  passed: number
  failed: number
  toolSelection: { passed: number; total: number; rate: string }
  paramQuality: { passed: number; total: number; rate: string }
  hallucination: { passed: number; total: number; rate: string }
  overallRate: string
  avgDurationMs: number
  totalDurationMs: number
  failures: Array<{ caseId: string; input: string; errors: string[] }>
}

/**
 * Print eval results to console
 */
export function printEvalResults(summary: EvalSummary): void {
  console.log('\n' + '='.repeat(60))
  console.log('LLM EVALUATION RESULTS')
  console.log('='.repeat(60))
  console.log(`Total Cases: ${summary.total}`)
  console.log(`Passed: ${summary.passed}`)
  console.log(`Failed: ${summary.failed}`)
  console.log(`Overall Rate: ${summary.overallRate}`)
  console.log('')
  console.log('DIMENSION SCORES:')
  console.log(`  Tool Selection:   ${summary.toolSelection.rate} (${summary.toolSelection.passed}/${summary.toolSelection.total})`)
  console.log(`  Parameter Quality: ${summary.paramQuality.rate} (${summary.paramQuality.passed}/${summary.paramQuality.total})`)
  console.log(`  Hallucination:     ${summary.hallucination.rate} (${summary.hallucination.passed}/${summary.hallucination.total})`)
  console.log('')
  console.log(`Avg Duration: ${summary.avgDurationMs}ms`)
  console.log(`Total Time: ${summary.totalDurationMs}ms`)

  if (summary.failures.length > 0) {
    console.log('\n' + '-'.repeat(60))
    console.log('FAILURES:')
    console.log('-'.repeat(60))
    for (const failure of summary.failures) {
      console.log(`\n[${failure.caseId}] ${failure.input}`)
      for (const error of failure.errors) {
        console.log(`  ❌ ${error}`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
}
