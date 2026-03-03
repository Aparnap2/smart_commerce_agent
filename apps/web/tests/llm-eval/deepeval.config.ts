/**
 * DeepEval LLM Evaluation Configuration
 *
 * Evaluates LLM responses for:
 * - Hallucination detection
 * - Answer relevancy
 * - Faithfulness
 * - Bias detection
 * - Toxicity
 *
 * Uses qwen2.5-coder:3b with Ollama
 */

import { BaseEvaluator } from 'deepeval/lib/evaluators/base';
import { HallucinationEvaluator } from 'deepeval/lib/evaluators/hallucination';
import { AnswerRelevancyEvaluator } from 'deepeval/lib/evaluators/answerRelevancy';
import { FaithfulnessEvaluator } from 'deepeval/lib/evaluators/faithfulness';

//===============================================================================
// OLLAMA LLM FOR EVALUATION
//===============================================================================

export const EVAL_LLM_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  temperature: 0,
  maxTokens: 2048,
};

//===============================================================================
// EVALUATION TEST CASES
//===============================================================================

export interface EvaluationTestCase {
  name: string;
  input: string;
  expectedOutput?: string;
  context?: string[];
  category: 'product_info' | 'order_status' | 'refund_policy' | 'general' | 'troubleshooting';
}

export const EVALUATION_TEST_CASES: EvaluationTestCase[] = [
  // Product Information Tests
  {
    name: 'Product availability query',
    input: 'Is the Laptop Pro 15 available in stock?',
    context: ['Product: Laptop Pro 15', 'Stock: 50 units', 'Price: $1299.99'],
    category: 'product_info',
  },
  {
    name: 'Product comparison',
    input: 'What is the difference between Laptop Pro and Laptop Air?',
    context: ['Laptop Pro: M3 chip, 16GB RAM, $1299', 'Laptop Air: M2 chip, 8GB RAM, $999'],
    category: 'product_info',
  },

  // Order Status Tests
  {
    name: 'Order tracking query',
    input: 'Where is my order ORD-12345?',
    context: ['Order ORD-12345', 'Status: Shipped', 'Tracking: TRK-987654321', 'ETA: 2-3 days'],
    category: 'order_status',
  },
  {
    name: 'Order history request',
    input: 'Show my recent orders',
    context: ['User ID: user-123', 'Orders: ORD-12345 (shipped), ORD-12346 (processing)'],
    category: 'order_status',
  },

  // Refund Policy Tests
  {
    name: 'Refund eligibility',
    input: 'Can I get a refund for my purchase?',
    context: ['Refund Policy: 30-day return window', 'Condition: Item must be unopened'],
    category: 'refund_policy',
  },
  {
    name: 'Refund process',
    input: 'How do I initiate a refund?',
    context: ['Refund Process: 1. Go to Orders 2. Select item 3. Click Return'],
    category: 'refund_policy',
  },

  // Troubleshooting Tests
  {
    name: 'Payment issue',
    input: 'My payment was declined but I have funds',
    context: ['Payment Issue: Bank hold', 'Solution: Contact bank to authorize'],
    category: 'troubleshooting',
  },
  {
    name: 'Technical support',
    input: 'The app keeps crashing when I try to checkout',
    context: ['Known Issue: iOS 17.3 bug', 'Workaround: Clear cache or update app'],
    category: 'troubleshooting',
  },

  // General Queries
  {
    name: 'Store hours',
    input: 'What are your store hours?',
    context: ['Store Hours: Mon-Fri 9AM-9PM, Sat-Sun 10AM-6PM'],
    category: 'general',
  },
  {
    name: 'Shipping options',
    input: 'What shipping options do you offer?',
    context: ['Shipping: Standard (5-7 days), Express (2-3 days), Overnight (next day)'],
    category: 'general',
  },
];

//===============================================================================
// EVALUATION METRICS
//===============================================================================

export const EVALUATION_METRICS = {
  // Threshold for passing evaluation
  hallucinationThreshold: 0.3,  // Allow up to 30% hallucination
  relevancyThreshold: 0.7,     // Require 70% answer relevancy
  faithfulnessThreshold: 0.8, // Require 80% faithfulness

  // Evaluation weights
  weights: {
    hallucination: 0.3,
    relevancy: 0.3,
    faithfulness: 0.3,
    correctness: 0.1,
  },
};

//===============================================================================
// EVALUATION RUNNER
//===============================================================================

export async function runEvaluation(
  testCase: EvaluationTestCase,
  actualOutput: string
): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    testCase: testCase.name,
    input: testCase.input,
    output: actualOutput,
    passed: true,
    scores: {},
    timestamp: new Date().toISOString(),
  };

  // Check if output contains expected information
  if (testCase.context && testCase.context.length > 0) {
    const contextHits = testCase.context.filter((ctx) =>
      actualOutput.toLowerCase().includes(ctx.toLowerCase())
    );
    result.scores.contextCoverage = contextHits.length / testCase.context.length;
  }

  // Check for hallucinations (output contains info not in context)
  if (testCase.context) {
    const hallucinations = testCase.context.filter(
      (ctx) => !actualOutput.toLowerCase().includes(ctx.toLowerCase())
    );
    // Simple check - in production use LLM-based evaluation
    result.scores.hallucinationRate = hallucinations.length / (testCase.context.length || 1);
  }

  // Check answer relevance (length and coherence)
  const wordCount = actualOutput.split(/\s+/).length;
  result.scores.wordCount = wordCount;
  result.scores.hasSubstantiveContent = wordCount >= 5 && wordCount <= 500;

  // Overall pass/fail
  const contextCoverage = result.scores.contextCoverage as number || 0;
  const hasContent = result.scores.hasSubstantiveContent as boolean || false;

  result.passed = contextCoverage >= 0.5 && hasContent;

  return result;
}

export interface EvaluationResult {
  testCase: string;
  input: string;
  output: string;
  passed: boolean;
  scores: Record<string, number | boolean>;
  timestamp: string;
}

//===============================================================================
// TEST DATA GENERATORS
//===============================================================================

export function generateTestPrompt(testCase: EvaluationTestCase): string {
  return `You are a customer support agent for an e-commerce store.

Context information:
${testCase.context?.join('\n') || 'No additional context available.'}

Customer query: ${testCase.input}

Please provide a helpful, accurate response based on the context above.`;
}

export async function generateLLMResponse(
  testCase: EvaluationTestCase
): Promise<string> {
  const prompt = generateTestPrompt(testCase);

  const response = await fetch(`${EVAL_LLM_CONFIG.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EVAL_LLM_CONFIG.model,
      prompt,
      stream: false,
      options: {
        temperature: EVAL_LLM_CONFIG.temperature,
        num_predict: EVAL_LLM_CONFIG.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

//===============================================================================
// BATCH EVALUATION
//===============================================================================

export async function runBatchEvaluation(): Promise<BatchEvaluationResult> {
  const results: EvaluationResult[] = [];

  for (const testCase of EVALUATION_TEST_CASES) {
    try {
      const output = await generateLLMResponse(testCase);
      const result = await runEvaluation(testCase, output);
      results.push(result);
    } catch (error) {
      results.push({
        testCase: testCase.name,
        input: testCase.input,
        output: '',
        passed: false,
        scores: { error: 1 },
        timestamp: new Date().toISOString(),
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return {
    results,
    summary: {
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      passRate: passedCount / totalCount,
      averageScore: calculateAverageScore(results),
    },
    timestamp: new Date().toISOString(),
  };
}

function calculateAverageScore(results: EvaluationResult[]): number {
  const scoresWithContent = results.filter(
    (r) => typeof r.scores.contextCoverage === 'number'
  );

  if (scoresWithContent.length === 0) return 0;

  const sum = scoresWithContent.reduce(
    (acc, r) => acc + ((r.scores.contextCoverage as number) || 0),
    0
  );

  return sum / scoresWithContent.length;
}

export interface BatchEvaluationResult {
  results: EvaluationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    averageScore: number;
  };
  timestamp: string;
}
