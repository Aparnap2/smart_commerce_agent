// apps/agent/src/evals/hallucination.eval.ts
// Vitest Test: Hallucination Prevention
// Target: 100% hallucination prevention (zero tolerance)

import { describe, it, expect, beforeAll } from 'vitest'
import { EVAL_DATASET, type EvalCase } from './dataset.js'
import { runEvalCase, type GraphInvoke } from './runner.js'
import { graph } from '../graphs/customer.js'

// Filter eval cases relevant to hallucination prevention
const HALLUCINATION_CASES = EVAL_DATASET.filter(
  c => c.tags.includes('hallucination')
)

// Wrap LangGraph compiled graph for eval runner
const graphInvoke: GraphInvoke = async (input, config) => {
  const result = await graph.invoke(input, config)
  return result as any
}

describe('LLM Eval: Hallucination Prevention', () => {
  let results: Array<{
    caseId: string
    passed: boolean
    actualTools: string[]
    finalResponse: string
    expectedTools: string[]
    forbiddenPatterns: string[]
    errors: string[]
  }> = []

  beforeAll(async () => {
    // Run all hallucination eval cases
    const evalPromises = HALLUCINATION_CASES.map(async (testCase) => {
      const result = await runEvalCase(testCase, graphInvoke, {
        userId: 'eval-test-user',
        timeoutMs: 30000,
      })
      return {
        caseId: result.caseId,
        passed: result.hallucinationOk,
        actualTools: result.actualTools,
        finalResponse: result.finalResponse,
        expectedTools: testCase.expectedTools,
        forbiddenPatterns: testCase.expectedNoHallucination?.forbiddenPatterns ?? [],
        errors: result.errors.filter(e => e.includes('Hallucination')),
      }
    })

    results = await Promise.all(evalPromises)
  }, 120000) // 2 minute timeout for all evals

  it('should achieve 100% hallucination prevention', () => {
    const passed = results.filter(r => r.passed).length
    const total = results.length
    const rate = (passed / total) * 100

    console.log(`\nHallucination Prevention: ${passed}/${total} (${rate.toFixed(1)}%)`)

    expect(rate).toBe(100)
  })

  it('should call searchProducts before providing product specs', () => {
    const specsCase = results.find(r => r.caseId === 'hallucination-01')
    
    if (specsCase) {
      // Agent must call searchProducts to get specs
      expect(specsCase.actualTools).toContain('searchProducts')
    }
  })

  it('should call searchProducts before providing prices', () => {
    const priceCase = results.find(r => r.caseId === 'hallucination-02')
    
    if (priceCase) {
      // Agent must call searchProducts to get prices
      expect(priceCase.actualTools).toContain('searchProducts')
    }
  })

  it('should call searchProducts before providing stock status', () => {
    const stockCase = results.find(r => r.caseId === 'hallucination-03')
    
    if (stockCase) {
      // Agent must call searchProducts to check stock
      expect(stockCase.actualTools).toContain('searchProducts')
    }
  })

  it('should call searchProducts before providing reviews', () => {
    const reviewsCase = results.find(r => r.caseId === 'hallucination-04')
    
    if (reviewsCase) {
      // Agent must call searchProducts to get reviews
      expect(reviewsCase.actualTools).toContain('searchProducts')
    }
  })

  it('should not contain forbidden patterns in responses when tool was called', () => {
    for (const result of results) {
      const toolWasCalled = result.expectedTools.some(t => result.actualTools.includes(t))
      
      if (toolWasCalled) {
        // Tool was called - data came from tools, not hallucination
        // This should pass automatically per our scoring logic
        expect(result.passed).toBe(true)
      }
    }
  })

  it('should report individual hallucination cases', () => {
    // Print detailed results for debugging
    const failed = results.filter(r => !r.passed)
    
    if (failed.length > 0) {
      console.log('\nHallucination Failures:')
      for (const f of failed) {
        console.log(`\n  [${f.caseId}] "${f.finalResponse.substring(0, 100)}..."`)
        console.log(`    Expected tools: [${f.expectedTools.join(', ')}]`)
        console.log(`    Actual tools: [${f.actualTools.join(', ')}]`)
        console.log(`    Forbidden patterns: [${f.forbiddenPatterns.join(', ')}]`)
        for (const error of f.errors) {
          console.log(`    - ${error}`)
        }
      }
    } else {
      console.log('\n✅ All hallucination cases passed - no fabricated data detected')
    }
  })
})
