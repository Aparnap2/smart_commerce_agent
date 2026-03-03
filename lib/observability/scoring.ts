/**
 * LangGraph Agent Scoring System
 *
 * Provides automated scoring and evaluation for agent responses.
 * Supports LLM-based evaluation and rule-based metrics.
 *
 * @packageDocumentation
 */

import { getLangfuseClient, addTraceScore } from './langfuse';
import { env } from '@/lib/env';

/**
 * Scoring configuration
 */
interface ScoringConfig {
  /** Enable LLM-based evaluation */
  useLLMEvaluation: boolean;
  /** Enable rule-based metrics */
  useRuleBasedMetrics: boolean;
  /** Score thresholds */
  thresholds: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
}

/**
 * Scoring result
 */
interface ScoringResult {
  overallScore: number;
  scores: {
    relevance: number;
    accuracy: number;
    completeness: number;
    coherence: number;
    helpfulness: number;
  };
  feedback: string[];
  evaluationModel?: string;
  evaluationLatencyMs: number;
}

/**
 * Default scoring configuration
 */
const DEFAULT_CONFIG: ScoringConfig = {
  useLLMEvaluation: true,
  useRuleBasedMetrics: true,
  thresholds: {
    excellent: 0.9,
    good: 0.75,
    acceptable: 0.6,
    poor: 0.4,
  },
};

/**
 * Evaluate agent response using LLM
 */
export async function evaluateWithLLM(
  query: string,
  response: string,
  context?: {
    toolResults?: unknown[];
    conversationHistory?: Array<{ role: string; content: string }>;
  }
): Promise<ScoringResult> {
  const startTime = Date.now();

  const prompt = `You are an expert evaluator for a customer support AI agent. Evaluate the following response based on these criteria:

1. RELEVANCE: Does the response directly address the user's query?
2. ACCURACY: Is the information factually correct and complete?
3. COMPLETENESS: Does it provide all necessary information?
4. COHERENCE: Is the response logically organized and easy to understand?
5. HELPFULNESS: Would this response be satisfactory to a real customer?

User Query: "${query}"

Agent Response: "${response}"

${context?.toolResults ? `Tool Results Used: ${JSON.stringify(context.toolResults)}` : ''}
${context?.conversationHistory ? `Conversation History: ${JSON.stringify(context.conversationHistory.slice(-3))}` : ''}

Respond with a JSON object:
{
  "scores": {
    "relevance": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "completeness": 0.0-1.0,
    "coherence": 0.0-1.0,
    "helpfulness": 0.0-1.0
  },
  "feedback": ["feedback point 1", "feedback point 2"]
}`;

  try {
    // Use Azure AI Foundry for scoring
    const response_1 = await fetch(
      `${env.AZURE_OPENAI_BASE_URL}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI response evaluator. Always respond with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      }
    );

    if (!response_1.ok) {
      throw new Error('LLM evaluation failed');
    }

    const data = await response_1.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const scores = parsed.scores || {};
     const overallScore = (
       (scores.relevance ?? 0.7) +
       (scores.accuracy ?? 0.7) +
       (scores.completeness ?? 0.7) +
       (scores.coherence ?? 0.7) +
       (scores.helpfulness ?? 0.7)
     ) / 5;

    const evaluationLatencyMs = Date.now() - startTime;

    return {
      overallScore,
      scores: {
        relevance: scores.relevance ?? 0.7,
        accuracy: scores.accuracy ?? 0.7,
        completeness: scores.completeness ?? 0.7,
        coherence: scores.coherence ?? 0.7,
        helpfulness: scores.helpfulness ?? 0.7,
      },
      feedback: parsed.feedback || ['Response evaluated successfully'],
      evaluationModel: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
      evaluationLatencyMs,
    };
  } catch (error) {
    console.error('[Scoring] LLM evaluation error:', error);
    return createFallbackScoring(query, response, Date.now() - startTime);
  }
}

/**
 * Fallback rule-based scoring when LLM is unavailable
 */
function createFallbackScoring(
  query: string,
  response: string,
  latencyMs: number
): ScoringResult {
  const queryLower = query.toLowerCase();
  const responseLower = response.toLowerCase();

  // Calculate relevance based on keyword matching
  const queryWords = queryLower.split(/\s+/).filter((w: string) => w.length > 3);
  const matchedWords = queryWords.filter((w: string) => responseLower.includes(w));
  const relevance = queryWords.length > 0 ? matchedWords.length / queryWords.length : 0.8;

  // Rule-based metrics
  const hasGreeting = /^(hi|hello|hey|greetings)/i.test(response);
  const hasFarewell = /(thank|goodbye|bye|have a nice)/i.test(response);
  const hasQuestion = /\?$/.test(response);
  const hasCode = /```|\bfunction\b|\bconst\b|\blet\b|\bvar\b/.test(response);
  const hasList = /\n[-•*]|\n\d+\./.test(response);

  const coherence = (
    (hasGreeting ? 0.1 : 0) +
    (hasFarewell ? 0.1 : 0) +
    (hasCode ? 0.3 : 0.2) +
    (hasList ? 0.2 : 0.1) +
    (response.length > 50 ? 0.2 : 0)
  );

  const completeness = Math.min(1, response.length / 500) * 0.7 + 0.3;

  const accuracy = 0.8; // Default assumption of accuracy
  const helpfulness = (relevance + coherence + completeness) / 3;

  const overallScore = (relevance + accuracy + completeness + coherence + helpfulness) / 5;

  const feedback: string[] = [];
  if (relevance < 0.5) feedback.push('Response may not fully address the query');
  if (response.length < 50) feedback.push('Response is very brief');
  if (hasCode) feedback.push('Includes code or technical content');
  if (!hasGreeting) feedback.push('Consider adding a greeting');
  if (overallScore >= 0.8) feedback.push('Overall good response');
  else if (overallScore >= 0.6) feedback.push('Response is acceptable but could be improved');

  return {
    overallScore,
    scores: {
      relevance: Math.min(1, relevance + 0.2),
      accuracy,
      completeness: Math.min(1, completeness + 0.2),
      coherence: Math.min(1, coherence + 0.2),
      helpfulness,
    },
    feedback: feedback.length > 0 ? feedback : ['Response evaluated successfully'],
    evaluationModel: 'rule-based-fallback',
    evaluationLatencyMs: latencyMs,
  };
}

/**
 * Score a complete agent interaction
 */
export async function scoreAgentInteraction(params: {
  threadId: string;
  userId: string;
  query: string;
  response: string;
  toolResults?: unknown[];
  context?: Record<string, unknown>;
}): Promise<ScoringResult> {
  const { query, response, toolResults, context } = params;

  const config = DEFAULT_CONFIG;

  let result: ScoringResult;

  if (config.useLLMEvaluation) {
    result = await evaluateWithLLM(query, response, { toolResults });
  } else {
    result = createFallbackScoring(query, response, 0);
  }

  // Add scores to Langfuse trace if available
  const langfuse = getLangfuseClient();
  if (langfuse) {
    const trace = langfuse.trace({
      name: 'agent-evaluation',
      input: { query, response, toolResults },
      metadata: {
        threadId: params.threadId,
        userId: params.userId,
        ...context,
      },
    });

    addTraceScore(trace, 'overall', result.overallScore);
    addTraceScore(trace, 'relevance', result.scores.relevance);
    addTraceScore(trace, 'accuracy', result.scores.accuracy);
    addTraceScore(trace, 'completeness', result.scores.completeness);
    addTraceScore(trace, 'coherence', result.scores.coherence);
    addTraceScore(trace, 'helpfulness', result.scores.helpfulness);

    // Add evaluation metadata
    trace.update({
      output: result,
    });
  }

  return result;
}

/**
 * Get score classification based on thresholds
 */
export function classifyScore(score: number, config = DEFAULT_CONFIG): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (score >= config.thresholds.excellent) return 'excellent';
  if (score >= config.thresholds.good) return 'good';
  if (score >= config.thresholds.acceptable) return 'acceptable';
  return 'poor';
}

/**
 * Calculate aggregate scores for a session
 */
export function calculateSessionScores(
  scores: Array<{ overallScore: number; timestamp: number }>
): {
  averageScore: number;
  totalInteractions: number;
  scoreDistribution: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
} {
  if (scores.length === 0) {
    return {
      averageScore: 0,
      totalInteractions: 0,
      scoreDistribution: { excellent: 0, good: 0, acceptable: 0, poor: 0 },
      trend: 'stable',
    };
  }

  const sum = scores.reduce((acc, s) => acc + s.overallScore, 0);
  const averageScore = sum / scores.length;

  const scoreDistribution = {
    excellent: scores.filter(s => s.overallScore >= DEFAULT_CONFIG.thresholds.excellent).length,
    good: scores.filter(s => s.overallScore >= DEFAULT_CONFIG.thresholds.good && s.overallScore < DEFAULT_CONFIG.thresholds.excellent).length,
    acceptable: scores.filter(s => s.overallScore >= DEFAULT_CONFIG.thresholds.acceptable && s.overallScore < DEFAULT_CONFIG.thresholds.good).length,
    poor: scores.filter(s => s.overallScore < DEFAULT_CONFIG.thresholds.acceptable).length,
  };

  // Calculate trend based on recent vs earlier scores
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (scores.length >= 5) {
    const midpoint = Math.floor(scores.length / 2);
    const earlierAvg = scores.slice(0, midpoint).reduce((acc, s) => acc + s.overallScore, 0) / midpoint;
    const recentAvg = scores.slice(midpoint).reduce((acc, s) => acc + s.overallScore, 0) / (scores.length - midpoint);

    if (recentAvg - earlierAvg > 0.1) trend = 'improving';
    else if (earlierAvg - recentAvg > 0.1) trend = 'declining';
  }

  return {
    averageScore,
    totalInteractions: scores.length,
    scoreDistribution,
    trend,
  };
}

export type { ScoringConfig, ScoringResult };
