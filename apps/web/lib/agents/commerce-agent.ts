/**
 * Commerce Agent - LangGraph with Azure OpenAI
 *
 * A LangGraph agent that uses Azure OpenAI to:
 * - Search products
 * - Get order details
 * - Add to cart
 *
 * @file lib/agents/commerce-agent.ts
 */

import { AzureChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { env } from '../env.js';

const prisma = new PrismaClient();

// Initialize the model with Azure OpenAI
const model = new AzureChatOpenAI({
  azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiInstanceName: env.AZURE_OPENAI_BASE_URL?.split('.')[0].replace('https://', ''),
  azureOpenAIApiDeploymentName: env.AZURE_OPENAI_DEPLOYMENT,
  azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
  temperature: 0,
});

/**
 * Tool to fetch products from the database
 */
const getProductsTool = tool(
  async ({ category, limit = 10 }: { category?: string; limit?: number }) => {
    console.log('[TOOL] getProducts called:', { category, limit });

    try {
      const where = category ? { category } : {};
      const products = await prisma.product.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
      });

      return {
        type: 'product_list',
        products: products,
        count: products.length,
      };
    } catch (error) {
      console.error('[TOOL] getProducts error:', error);
      return { error: 'Failed to fetch products' };
    }
  },
  {
    name: 'get_products',
    description: 'Get a list of products from the catalog. Use this when users ask to see products or browse categories.',
    schema: z.object({
      category: z.string().optional().describe('Optional product category filter (e.g. Computers, Audio)'),
      limit: z.number().optional().default(10).describe('Maximum number of products to return'),
    }),
  }
);

/**
 * Tool to fetch order history for a customer
 */
const getOrdersTool = tool(
  async (_, config) => {
    const userId = config?.configurable?.user_id;
    if (!userId) {
      return { error: 'Authentication required' };
    }

    // Find the user to get their email
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: 'User not found' };
    }

    // Fetch orders for this user's email
    const orders = await prisma.order.findMany({
      where: {
        customer: {
          email: user.email
        }
      },
      include: {
        product: true,
        customer: true,
      },
      take: 5,
    });
    return { orders };
  },
  {
    name: 'get_orders',
    description: 'Get recent orders for the authenticated user.',
    schema: z.object({}),
  }
);

/**
 * Tool to add items to the cart (Simulated)
 */
const addToCartTool = tool(
  async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
    console.log('[TOOL] addToCart called:', { productId, quantity });

    return {
      success: true,
      message: `Added ${quantity} unit(s) of product ${productId} to your cart.`,
      action: 'cart_add',
      data: { productId, quantity },
    };
  },
  {
    name: 'add_to_cart',
    description: 'Add a specific product to the shopping cart.',
    schema: z.object({
      productId: z.string().describe('The ID of the product to add'),
      quantity: z.number().optional().default(1).describe('Quantity to add'),
    }),
  }
);

export const tools = [getProductsTool, getOrdersTool, addToCartTool];

/**
 * Creates the commerce agent with tools bound
 */
export function createCommerceAgent() {
  const modelWithTools = model.bindTools(tools);
  return modelWithTools;
}

export { getProductsTool, getOrdersTool, addToCartTool };
