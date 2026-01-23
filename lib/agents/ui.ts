/**
 * E-Commerce Support Agent - UI Agent
 *
 * Handles response formatting and streaming for frontend integration:
 * - format_response: Formats content for display (markdown, JSON, charts)
 * - stream_sse: Manages Server-Sent Events streaming
 * - update_chart: Prepares chart data for visualizations
 *
 * @packageDocumentation
 * TEMPORARILY DISABLED - LangGraph API incompatible with current version
 */

import type {
  AgentState,
  UIState,
  ToolResult,
  QueryContext,
} from './state';

import { UIStateSchema } from './state';

/**
 * UI agent annotation for state management.
 */
const UIAnnotation = {};

/**
 * Creates the UI agent graph.
 * TEMPORARILY DISABLED - returns null
 */
export function createUIGraph() {
  console.warn('LangGraph UI agent disabled - using Ollama route instead');
  return null;
}

/**
 * Formats a response for display.
 */
export function formatResponse(
  content: string,
  format: 'markdown' | 'json' | 'text' = 'markdown'
): string {
  switch (format) {
    case 'json':
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    case 'text':
      return content.replace(/[#*_`]/g, '');
    default:
      return content;
  }
}

/**
 * Prepares chart data for visualizations.
 */
export function updateChart(
  data: Record<string, number>,
  type: 'bar' | 'line' | 'pie' = 'bar'
): UIState {
  return {
    response_format: 'chart_data',
    chart_type: type,
    chart_data: data,
    streaming: false,
    partial_updates: [],
  };
}
