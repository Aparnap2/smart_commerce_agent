/**
 * LangGraph Chat API Route with Redis Checkpointing
 * Demonstrates how to use Redis-based state persistence for LangGraph workflows
 * TEMPORARILY DISABLED - LangGraph API incompatible with current version
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRedisHealth,
  getCheckpointManager,
  logger,
} from '@/lib/redis';
import { env } from '@/lib/env';

// Note: LangGraph StateGraph import temporarily disabled due to API changes
// import { StateGraph, END, START } from '@langchain/langgraph';

/**
 * GET /api/chat/langgraph
 * Returns health status and checkpoint information
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');
  const action = searchParams.get('action') || 'health';

  try {
    switch (action) {
      case 'health': {
        const health = await checkRedisHealth();
        return NextResponse.json({
          success: health.healthy,
          redis: health,
          mode: env.USE_REDIS ? 'redis' : 'memory',
          langgraph: 'disabled',
        });
      }

      case 'list': {
        if (!threadId) {
          return NextResponse.json(
            { error: 'threadId is required for list action' },
            { status: 400 }
          );
        }

        const manager = getCheckpointManager();
        const checkpoints = await manager.listCheckpoints(threadId, 10);

        return NextResponse.json({
          threadId,
          checkpoints,
        });
      }

      case 'metadata': {
        if (!threadId) {
          return NextResponse.json(
            { error: 'threadId is required for metadata action' },
            { status: 400 }
          );
        }

        const manager = getCheckpointManager();
        const metadata = await manager.getThreadMetadata(threadId);

        return NextResponse.json({
          threadId,
          metadata,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('API', 'GET request failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/langgraph
 * Returns info that LangGraph is temporarily disabled
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'LangGraph route temporarily disabled - use /api/chat/route-ollama instead',
    message: 'This endpoint will be re-enabled after LangGraph API migration',
  }, { status: 503 });
}

/**
 * DELETE /api/chat/langgraph
 * Deletes a thread and all its checkpoints
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId is required' },
      { status: 400 }
    );
  }

  try {
    const manager = getCheckpointManager();
    const success = await manager.deleteThread(threadId);

    logger.info('API', 'Thread deleted', { threadId, success });

    return NextResponse.json({
      success,
      threadId,
    });
  } catch (error) {
    logger.error('API', 'DELETE request failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
