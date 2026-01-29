'use client';

/**
 * Tool Call Display Component
 *
 * Displays MCP tool execution with status indicators and transparency.
 * Shows which tools are being called, their status, and execution time.
 */

import React, { useState, useEffect, useCallback } from 'react';

/**
 * Tool call event status types
 */
export type ToolCallStatus = 'pending' | 'executing' | 'completed' | 'error';

/**
 * Tool call event interface
 */
export interface ToolCallEvent {
  id: string;
  tool: string;
  status: ToolCallStatus;
  startTime: number;
  endTime?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

/**
 * Tool call display props
 */
interface ToolCallDisplayProps {
  /** Current list of tool call events */
  events: ToolCallEvent[];
  /** Maximum number of events to display */
  maxVisible?: number;
  /** Callback when an event is clicked */
  onEventClick?: (event: ToolCallEvent) => void;
  /** Show execution time for completed tools */
  showExecutionTime?: boolean;
  /** Animation speed in ms */
  animationSpeed?: number;
}

/**
 * Get status icon for display
 */
function getStatusIcon(status: ToolCallStatus): string {
  const icons: Record<ToolCallStatus, string> = {
    pending: '○',
    executing: '◐',
    completed: '✓',
    error: '✗',
  };
  return icons[status];
}

/**
 * Get status color for display
 */
function getStatusColor(status: ToolCallStatus): string {
  const colors: Record<ToolCallStatus, string> = {
    pending: 'text-gray-400',
    executing: 'text-blue-500 animate-pulse',
    completed: 'text-green-500',
    error: 'text-red-500',
  };
  return colors[status];
}

/**
 * Get tool display name
 */
function getToolDisplayName(tool: string): string {
  const names: Record<string, string> = {
    db_query: 'Database Query',
    web_search: 'Web Search',
    semantic_search: 'Semantic Search',
  };
  return names[tool] || tool.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format execution time
 */
function formatExecutionTime(startTime: number, endTime?: number): string {
  if (!endTime) return '...';

  const duration = endTime - startTime;

  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(2)}s`;
  } else {
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  }
}

/**
 * Animated spinner for executing tools
 */
function ExecutingSpinner({ speed = 200 }: { speed?: number }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const frames = ['◐', '◓', '◑', '◒'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [speed]);

  return <span>{frames[frame]}</span>;
}

/**
 * Tool Call Event Item Component
 */
interface ToolCallEventItemProps {
  event: ToolCallEvent;
  showExecutionTime: boolean;
  onClick?: () => void;
}

const ToolCallEventItem: React.FC<ToolCallEventItemProps> = ({
  event,
  showExecutionTime,
  onClick,
}) => {
  const icon = getStatusIcon(event.status);
  const colorClass = getStatusColor(event.status);
  const displayName = getToolDisplayName(event.tool);
  const executionTime = formatExecutionTime(event.startTime, event.endTime);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
        onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
      }`}
      onClick={onClick}
    >
      <span className={`${colorClass} text-lg w-6 text-center`}>
        {event.status === 'executing' ? <ExecutingSpinner /> : icon}
      </span>

      <span className="flex-1 font-mono text-sm">{displayName}</span>

      {showExecutionTime && event.status === 'completed' && (
        <span className="text-xs text-gray-500">{executionTime}</span>
      )}

      {event.status === 'executing' && (
        <span className="text-xs text-blue-500 animate-pulse">running...</span>
      )}
    </div>
  );
}

/**
 * Tool Call Display Component
 *
 * Displays a list of MCP tool calls with status indicators and execution timing.
 */
export function ToolCallDisplay({
  events,
  maxVisible = 10,
  onEventClick,
  showExecutionTime = true,
  animationSpeed = 200,
}: ToolCallDisplayProps): React.ReactElement {
  // Sort events by start time (most recent first for display)
  const sortedEvents = [...events].sort((a, b) => b.startTime - a.startTime);

  // Limit visible events
  const visibleEvents = sortedEvents.slice(0, maxVisible);

  // Count by status
  const statusCounts = events.reduce(
    (acc, event) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    },
    {} as Record<ToolCallStatus, number>
  );

  return (
    <div className="tool-call-display">
      {/* Header with summary */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span className="font-semibold">MCP Tools</span>
        {statusCounts.executing !== undefined && statusCounts.executing > 0 && (
          <span className="text-blue-500">{statusCounts.executing} running</span>
        )}
        {statusCounts.completed !== undefined && statusCounts.completed > 0 && (
          <span className="text-green-500">{statusCounts.completed} completed</span>
        )}
        {statusCounts.error !== undefined && statusCounts.error > 0 && (
          <span className="text-red-500">{statusCounts.error} errors</span>
        )}
      </div>

      {/* Tool call list */}
      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <ToolCallEventItem
            key={event.id}
            event={event}
            showExecutionTime={showExecutionTime}
            onClick={onEventClick ? () => onEventClick(event) : undefined}
          />
        ))}

        {events.length === 0 && (
          <div className="text-gray-400 text-sm italic p-2">No tools called yet</div>
        )}

        {events.length > maxVisible && (
          <div className="text-gray-500 text-xs p-2">
            +{events.length - maxVisible} more tool calls
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tool Call Event Detail Modal
 */
interface ToolCallDetailModalProps {
  event: ToolCallEvent | null;
  onClose: () => void;
}

export function ToolCallDetailModal({ event, onClose }: ToolCallDetailModalProps): React.ReactElement | null {
  if (!event) return null;

  const icon = getStatusIcon(event.status);
  const colorClass = getStatusColor(event.status);
  const displayName = getToolDisplayName(event.tool);
  const executionTime = formatExecutionTime(event.startTime, event.endTime);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 border-b pb-3">
          <span className={`${colorClass} text-2xl`}>
            {event.status === 'executing' ? <ExecutingSpinner /> : icon}
          </span>
          <div className="flex-1">
            <h3 className="font-semibold">{displayName}</h3>
            <p className="text-sm text-gray-500 font-mono">{event.tool}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Status:</span>
              <span className={`ml-2 font-medium ${colorClass}`}>{event.status}</span>
            </div>
            <div>
              <span className="text-gray-500">Duration:</span>
              <span className="ml-2 font-mono">{executionTime}</span>
            </div>
          </div>

          {event.input && (
            <div>
              <span className="text-gray-500 text-sm">Input:</span>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto font-mono">
                {JSON.stringify(event.input, null, 2)}
              </pre>
            </div>
          )}

          {event.output && (
            <div>
              <span className="text-gray-500 text-sm">Output:</span>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto font-mono">
                {JSON.stringify(event.output, null, 2)}
              </pre>
            </div>
          )}

          {event.error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <span className="text-red-600 dark:text-red-400 text-sm font-medium">Error:</span>
              <pre className="mt-1 text-xs text-red-700 dark:text-red-300 font-mono">{event.error}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tool Call Display with Detail Modal
 */
export function ToolCallDisplayWithModal({
  events,
  maxVisible = 10,
  onEventClick,
  showExecutionTime = true,
  animationSpeed = 200,
}: ToolCallDisplayProps): React.ReactElement {
  const [selectedEvent, setSelectedEvent] = useState<ToolCallEvent | null>(null);

  const handleEventClick = useCallback(
    (event: ToolCallEvent) => {
      if (onEventClick) {
        onEventClick(event);
      } else {
        setSelectedEvent(event);
      }
    },
    [onEventClick]
  );

  return (
    <>
      <ToolCallDisplay
        events={events}
        maxVisible={maxVisible}
        onEventClick={handleEventClick}
        showExecutionTime={showExecutionTime}
        animationSpeed={animationSpeed}
      />
      <ToolCallDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

export default ToolCallDisplay;
