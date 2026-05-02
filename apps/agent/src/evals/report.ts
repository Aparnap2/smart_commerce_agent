#!/usr/bin/env node
// apps/agent/src/evals/report.ts
// Standalone LLM Evaluation Report Script
// Usage: cd apps/agent && pnpm eval

import { graph } from '../graphs/customer.js'
import { EVAL_DATASET, EVAL_TARGETS, getEvalCasesByTag } from './dataset.js'
import { runAllEvals, type GraphInvoke, type EvalSummary } from './runner.js'
import { meetsTargets, formatScore } from './metrics.js'

// Wrap LangGraph compiled graph for eval runner
const graphInvoke: GraphInvoke = async (input, config) => {
  const result = await graph.invoke(input, config)
  return result as any
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

function printHeader(): void {
  console.log('\n' + '='.repeat(70))
  console.log(colorize('LLM EVALUATION REPORT', 'bright'))
  console.log(colorize('Agentic AI Quality Assessment', 'cyan'))
  console.log('='.repeat(70))
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Total Eval Cases: ${EVAL_DATASET.length}`)
  console.log('')
}

function printTargets(): void {
  console.log(colorize('TARGET THRESHOLDS:', 'bright'))
  console.log(`  Tool Selection:   ≥${EVAL_TARGETS.toolSelection}%`)
  console.log(`  Parameter Quality: ≥${EVAL_TARGETS.paramQuality}%`)
  console.log(`  Hallucination:     ≥${EVAL_TARGETS.hallucination}%`)
  console.log(`  Overall:           ≥${EVAL_TARGETS.overall}%`)
  console.log('')
}

function printDimensionScores(summary: any): void {
  console.log(colorize('DIMENSION SCORES:', 'bright'))
  
  const toolRate = parseFloat(summary.toolSelection.rate)
  const paramRate = parseFloat(summary.paramQuality.rate)
  const halRate = parseFloat(summary.hallucination.rate)
  const overallRate = parseFloat(summary.overallRate)

  const toolStatus = toolRate >= EVAL_TARGETS.toolSelection ? '✅' : '❌'
  const paramStatus = paramRate >= EVAL_TARGETS.paramQuality ? '✅' : '❌'
  const halStatus = halRate >= EVAL_TARGETS.hallucination ? '✅' : '❌'
  const overallStatus = overallRate >= EVAL_TARGETS.overall ? '✅' : '❌'

  console.log(`  ${toolStatus} Tool Selection:    ${summary.toolSelection.rate} (${formatScore(summary.toolSelection.passed, summary.toolSelection.total)})`)
  console.log(`  ${paramStatus} Parameter Quality: ${summary.paramQuality.rate} (${formatScore(summary.paramQuality.passed, summary.paramQuality.total)})`)
  console.log(`  ${halStatus} Hallucination:      ${summary.hallucination.rate} (${formatScore(summary.hallucination.passed, summary.hallucination.total)})`)
  console.log(`  ${overallStatus} Overall:           ${summary.overallRate} (${formatScore(summary.passed, summary.total)})`)
  console.log('')
}

function printByTag(results: any[]): void {
  const tags = new Set<string>()
  for (const c of EVAL_DATASET) {
    for (const tag of c.tags) {
      tags.add(tag)
    }
  }

  console.log(colorize('SCORES BY TAG:', 'bright'))
  
  for (const tag of Array.from(tags).sort()) {
    const tagCases = getEvalCasesByTag(tag)
    const tagCaseIds = new Set(tagCases.map(c => c.id))
    const tagResults = results.filter(r => tagCaseIds.has(r.caseId))
    
    if (tagResults.length > 0) {
      const passed = tagResults.filter(r => r.passed).length
      const total = tagResults.length
      const rate = ((passed / total) * 100).toFixed(1)
      
      const status = passed === total ? '✅' : '❌'
      console.log(`  ${status} ${tag.padEnd(20)} ${rate}% (${passed}/${total})`)
    }
  }
  console.log('')
}

function printFailures(summary: any): void {
  if (summary.failures.length === 0) {
    console.log(colorize('✅ ALL CASES PASSED!', 'green'))
    return
  }

  console.log(colorize('FAILURES:', 'red'))
  console.log('-'.repeat(70))
  
  for (const failure of summary.failures) {
    console.log(`\n${colorize(`[${failure.caseId}]`, 'yellow')} ${failure.input}`)
    for (const error of failure.errors) {
      console.log(`  ${colorize('❌', 'red')} ${error}`)
    }
  }
  console.log('')
}

function printPerformance(summary: any): void {
  console.log(colorize('PERFORMANCE:', 'bright'))
  console.log(`  Average Duration: ${summary.avgDurationMs}ms`)
  console.log(`  Total Time:       ${summary.totalDurationMs}ms`)
  console.log('')
}

function printConclusion(summary: any): void {
  const { met, failures } = meetsTargets(summary, EVAL_TARGETS)

  console.log('='.repeat(70))
  
  if (met) {
    console.log(colorize('✅ ALL TARGETS MET - LLM EVALS PASSED', 'green'))
    console.log('')
    console.log('The agent demonstrates:')
    console.log('  • Correct tool selection (≥90%)')
    console.log('  • Accurate parameter extraction (≥85%)')
    console.log('  • Zero hallucination (100% prevention)')
  } else {
    console.log(colorize('❌ TARGETS NOT MET - IMPROVEMENTS NEEDED', 'red'))
    console.log('')
    console.log('Failed thresholds:')
    for (const failure of failures) {
      console.log(`  • ${failure}`)
    }
  }
  
  console.log('='.repeat(70) + '\n')
}

async function main(): Promise<void> {
  printHeader()
  printTargets()

  console.log(colorize('Running evaluations...', 'cyan'))
  const start = Date.now()

  try {
    const { results, summary } = await runAllEvals(graphInvoke, EVAL_DATASET, {
      userId: 'eval-report-user',
      concurrency: 1, // Sequential to avoid rate limiting and reduce memory
    })

    printDimensionScores(summary)
    printByTag(results)
    printPerformance(summary)
    printFailures(summary)
    printConclusion(summary)

    // Exit with error code if targets not met
    const { met } = meetsTargets(summary, EVAL_TARGETS)
    process.exit(met ? 0 : 1)
  } catch (error) {
    console.error(colorize('Evaluation failed:', 'red'))
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run if executed directly
main()
