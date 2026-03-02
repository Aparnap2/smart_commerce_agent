/**
 * Support Agent - LangGraph Subgraph
 * 
 * Handles customer support interactions:
 * - Refund requests
 * - Order status inquiries
 * - General support tickets
 * - Policy questions (RAG)
 * 
 * Nodes: context_node → plan_node → policy_rag_node → decision_node → render_node
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state';
import { getCheckpointSaver } from '../redis/checkpointer';

/**
 * Context node - fetches ticket/order context
 */
async function contextNode(state: AgentStateType) {
  console.log('[SupportAgent] contextNode - fetching support context');
  
  return {
    metadata: {
      ...state.metadata,
      contextLoaded: true,
      timestamp: Date.now(),
    },
  };
}

/**
 * Plan node - determines support intent
 */
async function planNode(state: AgentStateType) {
  console.log('[SupportAgent] planNode - creating support plan');
  
  const intent = state.intent;
  
  let plan: Array<{ step: number; tool: string; type: 'AUTO' | 'MANUAL'; args: Record<string, unknown> }> = [];
  
  switch (intent) {
    case 'refund_request':
      plan = [
        { step: 1, tool: 'get_order', type: 'AUTO', args: {} },
        { step: 2, tool: 'policy_rag', type: 'AUTO', args: {} },
        { step: 3, tool: 'fraud_check', type: 'AUTO', args: {} },
        { step: 4, tool: 'create_refund', type: 'MANUAL', args: {} },
      ];
      break;
    case 'order_status':
      plan = [
        { step: 1, tool: 'get_order', type: 'AUTO', args: {} },
      ];
      break;
    case 'support':
    default:
      plan = [
        { step: 1, tool: 'policy_rag', type: 'AUTO', args: {} },
        { step: 2, tool: 'create_support_ticket', type: 'MANUAL', args: {} },
      ];
  }
  
  return { metadata: { ...state.metadata, plan } };
}

/**
 * Policy RAG node - retrieves relevant policy information
 */
async function policyRagNode(state: AgentStateType) {
  console.log('[SupportAgent] policyRagNode - querying policy knowledge base');
  
  // In a full implementation, this would:
  // 1. Query the RAG system with the user's question
  // 2. Retrieve return policy, shipping policy, etc.
  // 3. Return relevant context
  
  const policyContext = {
    returnWindow: '30 days',
    refundMethod: 'original payment method',
    shippingPolicy: 'Free shipping on orders over $50',
  };
  
  return {
    toolResults: [
      {
        tool: 'policy_rag',
        success: true,
        data: { policy: policyContext },
      },
    ],
  };
}

/**
 * Decision node - determines AUTO-APPROVE or MANUAL path
 */
async function decisionNode(state: AgentStateType) {
  console.log('[SupportAgent] decisionNode - making approval decision');
  
  // Simple fraud scoring logic
  // In production: use ML model for fraud detection
  const fraudScore = calculateFraudScore(state);
  const orderAmount = 100; // Would get from order
  
  let decision: 'AUTO_APPROVE' | 'PENDING' | 'DENY' = 'PENDING';
  
  if (fraudScore < 0.3 && orderAmount < 10000) {
    decision = 'AUTO_APPROVE';
  } else if (fraudScore > 0.7) {
    decision = 'DENY';
  }
  
  return {
    metadata: {
      ...state.metadata,
      decision,
      fraudScore,
    },
  };
}

/**
 * Calculate simple fraud score
 */
function calculateFraudScore(state: AgentStateType): number {
  // Simplified fraud scoring
  // In production: use ML model, check history, velocity, etc.
  return 0.2; // Low risk by default
}

/**
 * Render node - returns appropriate UI
 */
async function renderNode(state: AgentStateType) {
  console.log('[SupportAgent] renderNode - rendering response');
  
  const decision = state.metadata?.decision as string | undefined;
  const intent = state.intent;
  
  let uiComponent: string | undefined;
  let componentProps: Record<string, unknown> = {};
  
  if (intent === 'refund_request') {
    if (decision === 'AUTO_APPROVE') {
      uiComponent = 'RefundApproved';
      componentProps = { message: 'Your refund has been approved!' };
    } else if (decision === 'DENY') {
      uiComponent = 'RefundDenied';
      componentProps = { message: 'Your refund requires manual review.' };
    } else {
      uiComponent = 'RefundPending';
      componentProps = { message: 'Your refund is pending review.' };
    }
  } else if (intent === 'order_status') {
    uiComponent = 'OrderTracking';
  } else {
    uiComponent = 'TicketCreated';
  }
  
  return {
    uiComponents: uiComponent ? [{ component: uiComponent, props: componentProps }] : [],
  };
}

/**
 * Route based on decision
 */
function routeFromDecision(state: AgentStateType) {
  const decision = state.metadata?.decision as string | undefined;
  
  if (decision === 'AUTO_APPROVE') {
    return 'execute_auto';
  }
  return 'render_node';
}

/**
 * Create the SupportAgent subgraph
 */
export async function createSupportAgent() {
  const workflow = new StateGraph(AgentState);
  
  // Add nodes
  workflow.addNode('context_node', contextNode);
  workflow.addNode('plan_node', planNode);
  workflow.addNode('policy_rag_node', policyRagNode);
  workflow.addNode('decision_node', decisionNode);
  workflow.addNode('execute_auto', async (state: AgentStateType) => {
    // Execute auto-approved action
    console.log('[SupportAgent] execute_auto - auto-approving');
    return {
      toolResults: [
        { tool: 'refund_approved', success: true, data: { status: 'approved' } },
      ],
    };
  });
  workflow.addNode('render_node', renderNode);
  
  // Add edges
  workflow.addEdge(START, 'context_node');
  workflow.addEdge('context_node', 'plan_node');
  workflow.addEdge('plan_node', 'policy_rag_node');
  workflow.addEdge('policy_rag_node', 'decision_node');
  workflow.addConditionalEdges('decision_node', routeFromDecision, {
    execute_auto: 'execute_auto',
    render_node: 'render_node',
  });
  workflow.addEdge('execute_auto', 'render_node');
  workflow.addEdge('render_node', END);
  
  // Compile with checkpointer
  const { saver } = await getCheckpointSaver();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return workflow.compile({ checkpointer: saver as any });
}

/**
 * Get or create SupportAgent singleton
 */
let supportAgentInstance: ReturnType<typeof createSupportAgent> | null = null;

export async function getSupportAgent() {
  if (!supportAgentInstance) {
    supportAgentInstance = createSupportAgent();
  }
  return supportAgentInstance;
}
