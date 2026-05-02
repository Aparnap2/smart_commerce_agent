// apps/agent/src/evals/quick-eval.ts
// Quick LLM Evaluation - runs a subset of critical eval cases
// Usage: cd apps/agent && npx tsx src/evals/quick-eval.ts

import { graph } from '../graphs/customer.js'
import { EVAL_DATASET, EVAL_TARGETS } from './dataset.js'
import { runAllEvals, type GraphInvoke } from './runner.js'
import { meetsTargets, formatScore } from './metrics.js'

// Run only critical eval cases (10 instead of 32)
const QUICK_EVAL_CASES = EVAL_DATASET.filter(c => 
  c.id.startsWith('search-0') || 
  c.id.startsWith('cart-01') || 
  c.id.startsWith('orders-01') ||
  c.id.startsWith('returns-01') ||
  c.id.startsWith('no-tool-01') ||
  c.id.startsWith('hallucination-01')
).slice(0, 10)

const graphInvoke: GraphInvoke = async (input, config) => {
  const result = await graph.invoke(input, config)
  return result as any
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('QUICK LLM EVALUATION (10 critical cases)')
  console.log('='.repeat(60))
  console.log(`Cases: ${QUICK_EVAL_CASES.map(c => c.id).join(', ')}`)
  console.log('')

  try {
    const { results, summary } = await runAllEvals(graphInvoke, QUICK_EVAL_CASES, {
      userId: 'quick-eval-user',
      concurrency: 1,
    })

    console.log('\nRESULTS:')
    console.log(`  Total: ${summary.total}`)
    console.log(`  Passed: ${summary.passed}`)
    console.log(`  Failed: ${summary.failed}`)
    console.log(`  Overall: ${summary.overallRate}`)
    console.log('')
    console.log(`  Tool Selection: ${formatScore(summary.toolSelection.passed, summary.toolSelection.total)}`)
    console.log(`  Param Quality: ${formatScore(summary.paramQuality.passed, summary.paramQuality.total)}`)
    console.log(`  Hallucination: ${formatScore(summary.hallucination.passed, summary.hallucination.total)}`)
    console.log('')

    if (summary.failures.length > 0) {
      console.log('FAILURES:')
      for (const f of summary.failures) {
        console.log(`  [${f.caseId}] ${f.input}`)
        for (const error of f.errors) {
          console.log(`    - ${error}`)
        }
      }
    } else {
      console.log('✅ ALL CASES PASSED')
    }

    console.log('')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('Evaluation failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
