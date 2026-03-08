/**
 * LLM-as-Judge Scoring for RAG
 *
 * Evaluates RAG output quality using LLM-based scoring for
 * faithfulness, relevance, and other metrics.
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';
import { env } from '../env.js';

/**
 * Evaluation result from LLM judge
 */
export interface EvaluationResult {
  /** Faithfulness score (0-1) - does the answer follow from the context? */
  faithfulness: number;
  /** Relevance score (0-1) - does the answer address the query? */
  relevance: number;
  /** Context precision (0-1) - is relevant info ranked higher? */
  contextPrecision?: number;
  /** Answer relevance (0-1) - is the answer substantive? */
  answerRelevance?: number;
  /** Explanation for scores */
  explanation?: string;
  /** Raw LLM response */
  rawResponse?: string;
}

/**
 * RAG evaluation input
 */
export interface EvaluationInput {
  /** Original user query */
  query: string;
  /** Retrieved context */
  context: string;
  /** Generated answer */
  answer: string;
}

/**
 * LLM Judge configuration
 */
export interface LLMJudgeConfig {
  /** Model to use for evaluation */
  model: string;
  /** Ollama base URL */
  baseUrl: string;
  /** Temperature for evaluation */
  temperature: number;
  /** Enable detailed explanations */
  enableExplanation: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: LLMJudgeConfig = {
  model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
  temperature: 0,
  enableExplanation: true,
};

/**
 * Evaluate faithfulness - does the answer follow from the context?
 */
async function evaluateFaithfulness(
  query: string,
  context: string,
  answer: string,
  config: LLMJudgeConfig
): Promise<{ score: number; explanation: string }> {
  const prompt = `You are evaluating the faithfulness of an AI-generated answer.
Faithfulness measures whether the answer can be inferred from the provided context alone.

QUERY: ${query}

CONTEXT:
${context}

ANSWER:
${answer}

Evaluate faithfulness on a scale of 0 to 1:
- 1.0 = All claims in the answer can be inferred from the context
- 0.5 = Some claims can be inferred, some cannot
- 0.0 = No claims can be inferred from the context

Respond in this exact JSON format:
{
  "score": 0.0-1.0,
  "explanation": "Brief explanation of your score"
}

JSON:`;

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: 300,
        },
      }),
    });

    if (!response.ok) {
      logger.warn('RAG', 'Faithfulness evaluation failed', {
        status: response.status,
      });
      return { score: 0.5, explanation: 'Evaluation failed' };
    }

    const data = await response.json() as { response: string };
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, parseFloat(result.score) || 0.5)),
        explanation: result.explanation || '',
      };
    }

    return { score: 0.5, explanation: 'Could not parse LLM response' };
  } catch (error) {
    logger.error('RAG', 'Faithfulness evaluation error', error);
    return { score: 0.5, explanation: 'Evaluation error' };
  }
}

/**
 * Evaluate relevance - does the answer address the query?
 */
async function evaluateRelevance(
  query: string,
  context: string,
  answer: string,
  config: LLMJudgeConfig
): Promise<{ score: number; explanation: string }> {
  const prompt = `You are evaluating the relevance of an AI-generated answer.
Relevance measures whether the answer addresses the user's query.

QUERY: ${query}

CONTEXT:
${context}

ANSWER:
${answer}

Evaluate relevance on a scale of 0 to 1:
- 1.0 = Answer directly addresses the query
- 0.5 = Answer partially addresses the query
- 0.0 = Answer does not address the query at all

Respond in this exact JSON format:
{
  "score": 0.0-1.0,
  "explanation": "Brief explanation of your score"
}

JSON:`;

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: 300,
        },
      }),
    });

    if (!response.ok) {
      logger.warn('RAG', 'Relevance evaluation failed', {
        status: response.status,
      });
      return { score: 0.5, explanation: 'Evaluation failed' };
    }

    const data = await response.json() as { response: string };
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, parseFloat(result.score) || 0.5)),
        explanation: result.explanation || '',
      };
    }

    return { score: 0.5, explanation: 'Could not parse LLM response' };
  } catch (error) {
    logger.error('RAG', 'Relevance evaluation error', error);
    return { score: 0.5, explanation: 'Evaluation error' };
  }
}

/**
 * Evaluate answer relevance - is the answer substantive?
 */
async function evaluateAnswerRelevance(
  query: string,
  answer: string,
  config: LLMJudgeConfig
): Promise<{ score: number; explanation: string }> {
  const prompt = `You are evaluating answer relevance.
This measures whether the answer is substantive and not vague or incomplete.

QUERY: ${query}

ANSWER:
${answer}

Evaluate on a scale of 0 to 1:
- 1.0 = Answer is complete, specific, and substantive
- 0.5 = Answer is somewhat vague or incomplete
- 0.0 = Answer is empty, very vague, or just says "I don't know"

Respond in this exact JSON format:
{
  "score": 0.0-1.0,
  "explanation": "Brief explanation"
}

JSON:`;

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: 300,
        },
      }),
    });

    if (!response.ok) {
      return { score: 0.5, explanation: 'Evaluation failed' };
    }

    const data = await response.json() as { response: string };
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, parseFloat(result.score) || 0.5)),
        explanation: result.explanation || '',
      };
    }

    return { score: 0.5, explanation: 'Could not parse LLM response' };
  } catch (error) {
    logger.error('RAG', 'Answer relevance evaluation error', error);
    return { score: 0.5, explanation: 'Evaluation error' };
  }
}

/**
 * Evaluate RAG output using LLM-as-Judge
 *
 * @param input - Evaluation input (query, context, answer)
 * @param options - Evaluation options
 * @returns Evaluation results with scores
 *
 * @example
 * ```typescript
 * const result = await evaluateRAGOutput({
 *   query: 'What is the return policy?',
 *   context: 'Returns accepted within 30 days...',
 *   answer: 'You can return items within 30 days.',
 * });
 * ```
 */
export async function evaluateRAGOutput(
  input: EvaluationInput,
  options: Partial<LLMJudgeConfig> = {}
): Promise<EvaluationResult> {
  const config: LLMJudgeConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  logger.info('RAG', 'Starting LLM evaluation', {
    queryLength: input.query.length,
    contextLength: input.context.length,
    answerLength: input.answer.length,
  });

  try {
    // Run evaluations in parallel
    const [faithfulnessResult, relevanceResult, answerRelevanceResult] = await Promise.all([
      evaluateFaithfulness(input.query, input.context, input.answer, config),
      evaluateRelevance(input.query, input.context, input.answer, config),
      evaluateAnswerRelevance(input.query, input.answer, config),
    ]);

    const result: EvaluationResult = {
      faithfulness: faithfulnessResult.score,
      relevance: relevanceResult.score,
      answerRelevance: answerRelevanceResult.score,
      explanation: config.enableExplanation
        ? `Faithfulness: ${faithfulnessResult.explanation}\nRelevance: ${relevanceResult.explanation}\nAnswer Relevance: ${answerRelevanceResult.explanation}`
        : undefined,
    };

    logger.info('RAG', 'LLM evaluation complete', {
      faithfulness: result.faithfulness,
      relevance: result.relevance,
      answerRelevance: result.answerRelevance,
    });

    return result;
  } catch (error) {
    logger.error('RAG', 'LLM evaluation failed', error);
    // Return neutral scores on failure
    return {
      faithfulness: 0.5,
      relevance: 0.5,
      answerRelevance: 0.5,
      explanation: 'Evaluation failed',
    };
  }
}

/**
 * Quick relevance check (single metric, faster)
 */
export async function quickRelevanceCheck(
  query: string,
  answer: string,
  config: Partial<LLMJudgeConfig> = {}
): Promise<number> {
  const fullConfig: LLMJudgeConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const result = await evaluateAnswerRelevance(query, answer, fullConfig);
  return result.score;
}

/**
 * Batch evaluate multiple RAG outputs
 */
export async function batchEvaluate(
  inputs: EvaluationInput[],
  options: Partial<LLMJudgeConfig> = {}
): Promise<EvaluationResult[]> {
  logger.info('RAG', 'Starting batch evaluation', { count: inputs.length });

  // Process in batches of 5 to avoid overwhelming the LLM
  const results: EvaluationResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((input) => evaluateRAGOutput(input, options))
    );
    results.push(...batchResults);

    logger.debug('RAG', 'Batch complete', {
      processed: Math.min(i + batchSize, inputs.length),
      total: inputs.length,
    });
  }

  return results;
}

/**
 * Calculate average scores from evaluation results
 */
export function calculateAverageScores(
  results: EvaluationResult[]
): {
  avgFaithfulness: number;
  avgRelevance: number;
  avgAnswerRelevance: number;
  count: number;
} {
  if (results.length === 0) {
    return {
      avgFaithfulness: 0,
      avgRelevance: 0,
      avgAnswerRelevance: 0,
      count: 0,
    };
  }

  const sum = results.reduce(
    (acc, r) => ({
      faithfulness: acc.faithfulness + r.faithfulness,
      relevance: acc.relevance + r.relevance,
      answerRelevance: acc.answerRelevance + (r.answerRelevance || 0),
    }),
    { faithfulness: 0, relevance: 0, answerRelevance: 0 }
  );

  return {
    avgFaithfulness: sum.faithfulness / results.length,
    avgRelevance: sum.relevance / results.length,
    avgAnswerRelevance: sum.answerRelevance / results.length,
    count: results.length,
  };
}
