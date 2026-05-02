// apps/agent/src/evals/tool-selection.eval.ts
// Vitest Test: Tool Selection Accuracy
// Target: ≥90% tool selection accuracy

import { describe, it, expect, beforeAll } from 'vitest'
import { EVAL_DATASET, getEvalCasesByTag, type EvalCase } from './dataset.js'
import { runEvalCase, type GraphInvoke } from './runner.js'
import { graph } from '../graphs/customer.js'

// Filter eval cases relevant to tool selection
const TOOL_SELECTION_CASES = EVAL_DATASET.filter(
  c => c.tags.includes('search') ||
       c.tags.includes('cart') ||
       c.tags.includes('orders') ||
       c.tags.includes('returns') ||
       c.tags.includes('no-tool') ||
       c.tags.includes('multi-intent')
)

// Wrap LangGraph compiled graph for eval runner
const graphInvoke: GraphInvoke = async (input, config) => {
  const result = await graph.invoke(input, config)
  return result as any
}

describe('LLM Eval: Tool Selection', () => {
  let results: Array<{ caseId: string; passed: boolean; actualTools: string[]; expectedTools: string[]; errors: string[] }> = []

  beforeAll(async () => {
    // Run all tool selection eval cases
    const evalPromises = TOOL_SELECTION_CASES.map(async (testCase) => {
      const result = await runEvalCase(testCase, graphInvoke, {
        userId: 'eval-test-user',
        timeoutMs: 30000,
      })
      return {
        caseId: result.caseId,
        passed: result.toolSelectionOk,
        actualTools: result.actualTools,
        expectedTools: testCase.expectedTools,
        errors: result.errors.filter(e => e.includes('tool')),
      }
    })

    results = await Promise.all(evalPromises)
  }, 120000) // 2 minute timeout for all evals

  it('should achieve ≥90% tool selection accuracy', () => {
    const passed = results.filter(r => r.passed).length
    const total = results.length
    const rate = (passed / total) * 100

    console.log(`\nTool Selection Accuracy: ${passed}/${total} (${rate.toFixed(1)}%)`)

    expect(rate).toBeGreaterThanOrEqual(90)
  })

  it('should call searchProducts for search queries', () => {
    const searchCases = results.filter(r => 
      TOOL_SELECTION_CASES.find(c => c.id === r.caseId)?.tags.includes('search')
    )

    for (const result of searchCases) {
      expect(result.actualTools).toContain('searchProducts')
    }
  })

  it('should call viewCart for cart view queries', () => {
    const cartViewCases = results.filter(r => {
      const testCase = TOOL_SELECTION_CASES.find(c => c.id === r.caseId)
      return testCase?.tags.includes('cart') &&
        (testCase.input.toLowerCase().includes('what') ||
         testCase.input.toLowerCase().includes('show'))
    })

    for (const result of cartViewCases) {
      expect(result.actualTools).toContain('viewCart')
    }
  })

  it('should call addToCart for add to cart queries', () => {
    const cartAddCases = results.filter(r => {
      const testCase = TOOL_SELECTION_CASES.find(c => c.id === r.caseId)
      return testCase?.tags.includes('cart') &&
        testCase.input.toLowerCase().includes('add')
    })

    for (const result of cartAddCases) {
      expect(result.actualTools).toContain('addToCart')
    }
  })

  it('should call getOrders for order queries', () => {
    const orderCases = results.filter(r => 
      TOOL_SELECTION_CASES.find(c => c.id === r.caseId)?.tags.includes('orders')
    )

    for (const result of orderCases) {
      expect(result.actualTools).toContain('getOrders')
    }
  })

  it('should call initiateReturn for return queries', () => {
    const returnCases = results.filter(r => 
      TOOL_SELECTION_CASES.find(c => c.id === r.caseId)?.tags.includes('returns')
    )

    for (const result of returnCases) {
      expect(result.actualTools).toContain('initiateReturn')
    }
  })

  it('should NOT call tools for greetings', () => {
    const greetingCases = results.filter(r => 
      TOOL_SELECTION_CASES.find(c => c.id === r.caseId)?.tags.includes('no-tool')
    )

    for (const result of greetingCases) {
      expect(result.actualTools.length).toBe(0)
    }
  })

  it('should not call forbidden tools', () => {
    const casesWithForbidden = TOOL_SELECTION_CASES.filter(c => c.forbiddenTools?.length)

    for (const testCase of casesWithForbidden) {
      const result = results.find(r => r.caseId === testCase.id)
      if (result) {
        for (const forbidden of testCase.forbiddenTools!) {
          expect(result.actualTools).not.toContain(forbidden)
        }
      }
    }
  })

  it('should report individual case results', () => {
    // Print detailed results for debugging
    const failed = results.filter(r => !r.passed)
    
    if (failed.length > 0) {
      console.log('\nFailed Tool Selection Cases:')
      for (const f of failed) {
        console.log(`  [${f.caseId}] Expected: [${f.expectedTools.join(', ')}], Got: [${f.actualTools.join(', ')}]`)
        for (const error of f.errors) {
          console.log(`    - ${error}`)
        }
      }
    }
  })
})
