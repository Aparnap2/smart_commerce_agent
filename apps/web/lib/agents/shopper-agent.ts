/**
 * Shopper Agent - LangGraph Subgraph
 * 
 * Handles customer-facing interactions:
 * - Product search and recommendations
 * - Cart management
 * - Checkout flow
 * - Order tracking
 * 
 * Nodes: context_node → plan_node → execute_node → render_node → taste_update_node
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state';
import { getCheckpointSaver } from '../redis/checkpointer';

/**
 * Context node - fetches user context (cart, preferences, history)
 */
async function contextNode(state: AgentStateType) {
  console.log('[ShopperAgent] contextNode - fetching user context');
  
  // In a full implementation, this would fetch:
  // - Cart items from DB
  // - User preferences/taste profile
  // - Recent order history
  // - Browsing history
  
  return {
    metadata: {
      ...state.metadata,
      contextLoaded: true,
      timestamp: Date.now(),
    },
  };
}

/**
 * Plan node - creates execution plan using LLM
 */
async function planNode(state: AgentStateType) {
  console.log('[ShopperAgent] planNode - creating execution plan');
  
  // In a full implementation, this would call Azure LLM to:
  // 1. Analyze user intent
  // 2. Determine which tools to call
  // 3. Decide which need confirmation (AUTO vs CONFIRM)
  
  // For now, return a simple plan based on intent
  const intent = state.intent;
  const plan = generatePlan(intent);
  
  return {
    metadata: {
      ...state.metadata,
      plan,
    },
  };
}

/**
 * Generate a simple execution plan based on intent
 */
function generatePlan(intent: string | undefined) {
  switch (intent) {
    case 'product_search':
      return [
        { step: 1, tool: 'search_products', type: 'AUTO', args: {} },
      ];
    case 'cart_add':
      return [
        { step: 1, tool: 'add_to_cart', type: 'AUTO', args: {} },
      ];
    case 'checkout':
      return [
        { step: 1, tool: 'get_cart', type: 'AUTO', args: {} },
        { step: 2, tool: 'checkout.create', type: 'CONFIRM', args: {} },
      ];
    default:
      return [
        { step: 1, tool: 'respond', type: 'AUTO', args: {} },
      ];
  }
}

/**
 * Execute node - runs AUTO steps, buffers CONFIRM steps
 */
async function executeNode(state: AgentStateType) {
  console.log('[ShopperAgent] executeNode - executing plan');
  
  const plan = state.metadata?.plan as Array<{
    step: number;
    tool: string;
    type: 'AUTO' | 'CONFIRM';
    args: Record<string, unknown>;
  }> || [];
  
  const autoSteps = plan.filter(p => p.type === 'AUTO');
  const confirmSteps = plan.filter(p => p.type === 'CONFIRM');
  
  // Execute AUTO steps
  const toolResults = autoSteps.map(step => ({
    tool: step.tool,
    success: true,
    data: { executed: true, step: step.step },
  }));
  
  // Buffer CONFIRM steps for user approval
  const pendingConfirms = confirmSteps.map(step => ({
    step: step.step,
    tool: step.tool,
    args: step.args,
    description: `Execute ${step.tool}?`,
  }));
  
  return {
    toolResults,
    pendingConfirms,
  };
}

/**
 * Render node - decides which GenUI component to render
 */
async function renderNode(state: AgentStateType) {
  console.log('[ShopperAgent] renderNode - determining UI');
  
  const intent = state.intent;
  const toolResults = state.toolResults || [];
  
  // Determine UI component based on intent and tool results
  let uiComponent: string | undefined;
  let componentProps: Record<string, unknown> = {};
  
  if (intent === 'product_search' || intent === 'recommendation') {
    uiComponent = 'ProductGrid';
    const products = toolResults.find(r => r.tool === 'search_products')?.data?.products || [];
    componentProps = { products };
  } else if (intent === 'cart_view' || intent === 'cart_add') {
    uiComponent = 'CartDrawer';
    const cartData = toolResults.find(r => r.tool === 'get_cart')?.data || {};
    componentProps = { cart: cartData };
  } else if (intent === 'checkout') {
    uiComponent = 'CheckoutWizard';
  }
  
  return {
    uiComponents: uiComponent ? [{ component: uiComponent, props: componentProps }] : [],
  };
}

/**
 * Taste update node - updates user preference vector
 */
async function tasteUpdateNode(state: AgentStateType) {
  console.log('[ShopperAgent] tasteUpdateNode - updating preferences');
  
  // In a full implementation, this would:
  // 1. Extract product preferences from the interaction
  // 2. Update the user's taste vector in Redis/Cosmos DB
  
  return {
    metadata: {
      ...state.metadata,
      tasteUpdated: true,
    },
  };
}

/**
 * Route from execute to appropriate next node
 */
function routeFromExecute(state: AgentStateType) {
  const pendingConfirms = state.pendingConfirms || [];
  
  if (pendingConfirms.length > 0) {
    return 'confirm_node';
  }
  return 'render_node';
}

/**
 * Create the ShopperAgent subgraph
 */
export async function createShopperAgent() {
  const workflow = new StateGraph(AgentState);
  
  // Add nodes
  workflow.addNode('context_node', contextNode);
  workflow.addNode('plan_node', planNode);
  workflow.addNode('execute_node', executeNode);
  workflow.addNode('confirm_node', async (state: AgentStateType) => {
    // This node waits for user confirmation
    // In a real implementation, it would pause and wait
    console.log('[ShopperAgent] confirm_node - waiting for user');
    return {};
  });
  workflow.addNode('render_node', renderNode);
  workflow.addNode('taste_update_node', tasteUpdateNode);
  
  // Add edges
  workflow.addEdge(START, 'context_node');
  workflow.addEdge('context_node', 'plan_node');
  workflow.addEdge('plan_node', 'execute_node');
  workflow.addConditionalEdges('execute_node', routeFromExecute, {
    confirm_node: 'confirm_node',
    render_node: 'render_node',
  });
  workflow.addEdge('confirm_node', 'render_node');
  workflow.addEdge('render_node', 'taste_update_node');
  workflow.addEdge('taste_update_node', END);
  
  // Compile with checkpointer
  const { saver } = await getCheckpointSaver();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return workflow.compile({ checkpointer: saver as any });
}

/**
 * Get or create ShopperAgent singleton
 */
let shopperAgentInstance: ReturnType<typeof createShopperAgent> | null = null;

export async function getShopperAgent() {
  if (!shopperAgentInstance) {
    shopperAgentInstance = createShopperAgent();
  }
  return shopperAgentInstance;
}
