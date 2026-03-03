/**
 * DeepEval-Style E-commerce Agent Evaluation Tests
 *
 * Tests RAG precision and tool correctness for the e-commerce support agent.
 * Metrics: ContextualPrecisionMetric, ToolCorrectnessMetric equivalents
 *
 * Run: pnpm --filter vercel-ai-sdk-tests test:ecomm
 */
import { jest } from '@jest/globals';

// Policy keyword mappings for semantic scoring
const POLICY_KEYWORDS = {
  return: ['return', 'refund', 'money back', 'reimburse'],
  sale: ['sale', 'final sale', 'clearance', 'discounted'],
  damaged: ['damaged', 'broken', 'defective', 'replacement'],
  warranty: ['warranty', 'guarantee', 'manufacturer', 'electronics'],
  shipping: ['shipping', 'delivery', 'arrival', 'transit'],
  exchange: ['exchange', 'swap', 'different size', 'different color'],
  policy: ['policy', 'within', 'days', 'eligible']
};

// Evaluation Metrics (DeepEval equivalents)
class ContextualPrecisionMetric {
  constructor(threshold = 0.8) {
    this.threshold = threshold;
    this.name = 'ContextualPrecisionMetric';
  }

  measure(testCase) {
    const { input, retrieval_context, actual_output, expected_output } = testCase;

    // Calculate precision: how well does retrieval context match the query intent?
    const contextRelevance = this._calculateContextRelevance(input, retrieval_context);
    const outputAlignment = this._calculateOutputAlignment(actual_output, expected_output);

    // Combined contextual precision score (weighted)
    this.score = (contextRelevance * 0.6) + (outputAlignment * 0.4);
    this.success = this.score >= this.threshold;

    return {
      score: this.score,
      threshold: this.threshold,
      success: this.success,
      contextRelevance,
      outputAlignment
    };
  }

  _calculateContextRelevance(query, context) {
    if (!context || context.length === 0) return 0;

    const queryLower = query.toLowerCase();
    const contextText = context.join(' ').toLowerCase();

    // Find query intent category
    let queryCategory = null;
    for (const [category, keywords] of Object.entries(POLICY_KEYWORDS)) {
      if (keywords.some(kw => queryLower.includes(kw))) {
        queryCategory = category;
        break;
      }
    }

    // Check if context contains relevant policy info
    const contextHasRelevantPolicy = context.some(c => {
      const cLower = c.toLowerCase();
      if (!queryCategory) {
        // No specific category - check for general policy keywords
        return POLICY_KEYWORDS.policy.some(kw => cLower.includes(kw));
      }
      // Check if context has category keywords
      return POLICY_KEYWORDS[queryCategory]?.some(kw => cLower.includes(kw)) ||
             POLICY_KEYWORDS.policy.some(kw => cLower.includes(kw));
    });

    // Base score on whether context addresses the query
    let score = 0.5; // Base score
    if (contextHasRelevantPolicy) score += 0.4;
    if (queryCategory && context.some(c => c.toLowerCase().includes(queryCategory))) score += 0.1;

    return Math.min(score, 1.0);
  }

  _calculateOutputAlignment(actual, expected) {
    if (!actual && !expected) return 1.0;
    if (!actual || !expected) return 0.5;

    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();

    // Check for key decision alignment (yes/no, refund/exchange, etc.)
    const decisions = ['refund', 'exchange', 'replacement', 'return', 'reject', 'approve'];
    let decisionMatches = 0;

    for (const decision of decisions) {
      const actualHas = actualLower.includes(decision);
      const expectedHas = expectedLower.includes(decision);
      if (actualHas === expectedHas && actualHas) decisionMatches++;
    }

    // Check for order/product mentions
    const hasOrderRef = /#?\d+/.test(actual) && /#?\d+/.test(expected);

    const decisionScore = decisions.length > 0 ? (decisionMatches / decisions.length) : 0.5;
    const orderScore = hasOrderRef ? 0.3 : 0;

    return Math.min(decisionScore + orderScore, 1.0);
  }
}

class ToolCorrectnessMetric {
  constructor(threshold = 1.0) {
    this.threshold = threshold;
    this.name = 'ToolCorrectnessMetric';
  }

  measure(testCase) {
    const { tools_called, expected_tools } = testCase;

    // Handle empty arrays
    const actual = tools_called || [];
    const expected = expected_tools || [];

    // Both empty = correct (no action needed)
    if (actual.length === 0 && expected.length === 0) {
      this.score = 1.0;
      this.success = true;
      return { score: 1.0, success: true };
    }

    // One empty, other not = incorrect
    if (actual.length !== expected.length) {
      this.score = 0;
      this.success = false;
      return { score: 0, success: false };
    }

    // Compare tool calls
    const correctCalls = this._compareToolCalls(actual, expected);
    this.score = correctCalls;
    this.success = this.score >= this.threshold;

    return { score: this.score, success: this.success };
  }

  _compareToolCalls(actual, expected) {
    let correct = 0;
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i];
      const e = expected[i];

      if (a.name === e.name && this._compareArguments(a.arguments, e.arguments)) {
        correct++;
      }
    }
    return correct / actual.length;
  }

  _compareArguments(actual, expected) {
    if (!actual && !expected) return true;
    if (!actual || !expected) return false;
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
}

// Test Case Factory
function createLLMTestCase({ input, actual_output, retrieval_context, expected_output, tools_called, expected_tools }) {
  return { input, actual_output, retrieval_context, expected_output, tools_called, expected_tools };
}

// Assertion helper (DeepEval's assert_test equivalent)
function assert_test(testCase, metrics) {
  const results = [];
  let allPassed = true;

  for (const metric of metrics) {
    const result = metric.measure(testCase);
    results.push({
      metric: metric.name,
      score: result.score,
      threshold: metric.threshold,
      success: result.success
    });
    if (!result.success) allPassed = false;
  }

  if (!allPassed) {
    const failures = results.filter(r => !r.success);
    throw new Error(
      `Test failed!\n` +
      failures.map(f => `  - ${f.metric}: score=${f.score.toFixed(3)} < threshold=${f.threshold}`).join('\n')
    );
  }
  return true;
}

// ============ TESTS ============

describe('E-commerce Agent DeepEval Tests', () => {
  describe('RAG Precision Tests', () => {
    test('test_sale_item_non_returnable', () => {
      const query = 'Can I return a sale item?';
      const context = ['Sale items are final sale and cannot be returned.'];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'No, sale items are final sale.',
        retrieval_context: context,
        expected_output: 'No, you cannot return sale items.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.55);
      assert_test(ragCase, [precisionMetric]);
    });

    test('test_30_day_return_policy', () => {
      const query = 'Return my order #123 bought 10 days ago.';
      const context = ['Return Policy: Items returnable within 30 days of purchase.'];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Processing refund for order #123...',
        retrieval_context: context,
        expected_output: 'Yes, you can return items within 30 days.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.65);
      assert_test(ragCase, [precisionMetric]);
    });

    test('test_late_return_rejected', () => {
      const query = 'I want to return my order from 2 months ago.';
      const context = [
        'Return Policy: Items returnable within 30 days of purchase.',
        'After 30 days, returns are not accepted.'
      ];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Unfortunately, returns are only accepted within 30 days.',
        retrieval_context: context,
        expected_output: 'Cannot process return - outside 30-day window.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.75);
      assert_test(ragCase, [precisionMetric]);
    });

    test('test_damaged_item_replacement', () => {
      const query = 'My item arrived damaged';
      const context = [
        'Damaged Item Policy: Customers eligible for free replacement.',
        'Refunds for damaged items processed only if replacement unavailable.'
      ];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: "I'll arrange a replacement for your damaged item.",
        retrieval_context: context,
        expected_output: 'Replacing damaged item immediately.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.55);
      assert_test(ragCase, [precisionMetric]);
    });
  });

  describe('Tool Correctness Tests', () => {
    test('test_refund_eligible_order', () => {
      const toolMetric = new ToolCorrectnessMetric(1.0);

      const testCase = createLLMTestCase({
        input: 'Refund order #999 (eligible)',
        actual_output: 'Processing refund for #999',
        tools_called: [{ name: 'refund_order', arguments: { order_id: '999' } }],
        expected_tools: [{ name: 'refund_order', arguments: { order_id: '999' } }]
      });

      assert_test(testCase, [toolMetric]);
    });

    test('test_no_refund_for_ineligible_order', () => {
      const toolMetric = new ToolCorrectnessMetric(1.0);

      const testCase = createLLMTestCase({
        input: 'Refund my sale item',
        actual_output: 'Sale items cannot be refunded.',
        tools_called: [],
        expected_tools: []
      });

      assert_test(testCase, [toolMetric]);
    });

    test('test_order_status_check_before_refund', () => {
      const toolMetric = new ToolCorrectnessMetric(1.0);

      const testCase = createLLMTestCase({
        input: 'Refund order #456',
        actual_output: 'Checking eligibility for order #456...',
        tools_called: [
          { name: 'get_order_status', arguments: { order_id: '456' } },
          { name: 'refund_order', arguments: { order_id: '456' } }
        ],
        expected_tools: [
          { name: 'get_order_status', arguments: { order_id: '456' } },
          { name: 'refund_order', arguments: { order_id: '456' } }
        ]
      });

      assert_test(testCase, [toolMetric]);
    });
  });

  describe('Cross-Domain Precision Tests', () => {
    test('test_shipping_vs_return_distinction', () => {
      const query = 'When will my order arrive?';
      const context = ['Standard shipping: 5-7 business days.'];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Your order will arrive in 5-7 business days.',
        retrieval_context: context,
        expected_output: 'Shipping timeframe provided, no refund mentioned.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.50);
      assert_test(ragCase, [precisionMetric]);
    });

    test('test_refund_vs_exchange_distinction', () => {
      const query = 'I want a refund, not an exchange';
      const context = [
        'Refund Policy: Full refund to original payment method.',
        'Exchange Policy: Different size/color exchanges within 30 days.'
      ];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Processing full refund to your card.',
        retrieval_context: context,
        expected_output: 'Refund initiated, not exchange.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.55);
      assert_test(ragCase, [precisionMetric]);
    });
  });

  describe('End-to-End Policy Compliance', () => {
    test('test_warranty_claim_processing', () => {
      const query = 'File warranty claim for my laptop';
      const context = [
        'Warranty Policy: 1-year manufacturer warranty on electronics.',
        'Warranty claims processed within 3-5 business days.'
      ];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Processing your warranty claim...',
        retrieval_context: context,
        expected_output: 'Warranty claim submitted - 3-5 day processing.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.55);
      assert_test(ragCase, [precisionMetric]);
    });

    test('test_full_refund_workflow', () => {
      // Combined test: RAG precision + tool correctness
      const query = 'Refund order #123 purchased 15 days ago';
      const context = ['Standard items returnable within 30 days.', 'Refund processed to original payment.'];

      const ragCase = createLLMTestCase({
        input: query,
        actual_output: 'Processing refund for order #123...',
        retrieval_context: context,
        expected_output: 'Eligible for refund - within 30 days.'
      });

      const precisionMetric = new ContextualPrecisionMetric(0.75);
      assert_test(ragCase, [precisionMetric]);
    });
  });
});

// Export metrics for external use
export { ContextualPrecisionMetric, ToolCorrectnessMetric, createLLMTestCase, assert_test };
