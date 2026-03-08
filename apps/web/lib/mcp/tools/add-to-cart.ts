/**
 * Add to Cart MCP Tool
 *
 * Provides idempotent cart item addition with optimistic locking.
 * Features:
 * - Zod schema validation
 * - Redis-based idempotency protection (30s TTL)
 * - Optimistic locking for concurrent cart updates
 * - Langfuse tracing for observability
 *
 * @file lib/mcp/tools/add-to-cart.ts
 */

import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { redis } from '@/lib/redis/client';
import { initializeLangfuse } from '@/lib/observability/langfuse';
import type { ToolResult } from '../types';

/**
 * Add to cart input schema with comprehensive validation
 */
export const addToCartSchema = z.object({
  /** Product ID to add to cart */
  productId: z.string().min(1, 'Product ID is required'),
  /** Quantity to add (1-99) */
  quantity: z.number().int().positive('Quantity must be positive').max(99, 'Quantity cannot exceed 99').default(1),
});

/**
 * Inferred input type from schema
 */
export type AddToCartInput = z.infer<typeof addToCartSchema>;

/**
 * Cart item structure stored in JSONB
 */
interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

/**
 * Cart model type
 */
interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Add to cart tool result
 */
export type AddToCartResult = {
  success: boolean;
  data?: {
    cart: Cart;
  };
  error?: string;
  metadata?: {
    executionTime?: number;
    userId?: string;
    traced?: boolean;
    idempotent?: boolean;
  };
};

/**
 * MCP Tool definition for cart.add_item
 *
 * Features:
 * - Zod schema validation at input boundary
 * - Idempotency via Redis (prevents double-add)
 * - Optimistic locking (handles concurrent updates)
 * - Langfuse tracing for observability
 *
 * @example
 * ```typescript
 * const result = await addToCart.execute(
 *   { productId: 'prod_123', quantity: 2 },
 *   'user-456'
 * );
 * ```
 */
export const addToCart = {
  /** Tool name for MCP protocol */
  name: 'cart.add_item',

  /** Human-readable description */
  description: 'Add a product to the user\'s cart with idempotency protection',

  /** Zod schema for input validation */
  schema: addToCartSchema,

  /** Whether user ID is required for execution */
  requireUserId: true,

  /**
   * Execute the add to cart tool
   *
   * @param args - Cart parameters validated against schema
   * @param userId - User ID (required for cart ownership)
   * @returns Updated cart or error
   *
   * @throws {z.ZodError} If input validation fails
   * @throws {Error} If database operation fails
   */
  execute: async (args: unknown, userId: string | null): Promise<AddToCartResult> => {
    // Initialize Langfuse for tracing
    const langfuse = initializeLangfuse();

    // Validate user ID (required for cart operations)
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required for cart operations',
        metadata: { executionTime: Date.now(), traced: true },
      };
    }

    // Create trace for observability
    const trace = langfuse.trace({
      name: 'mcp.cart.add_item',
      userId,
      metadata: { input: args },
    });

    // Create span for execution tracking
    const span = trace.span({
      name: 'addToCart.execute',
      input: args,
    });

    const startTime = Date.now();

    try {
      // Validate input with Zod
      const validatedArgs = await addToCartSchema.parseAsync(args);
      const { productId, quantity } = validatedArgs;

      // Generate idempotency key
      const idempotencyKey = `cart:${userId}:${productId}:add:${Math.floor(Date.now() / 1000)}`;

      // Check idempotency - return cached result if exists
      const existing = await redis.get(`idem:${idempotencyKey}`);
      if (existing) {
        const cachedResult = JSON.parse(existing) as AddToCartResult;

        span.end({
          output: { cached: true },
          metadata: { idempotent: true },
        });

        trace.end({
          output: { cached: true },
          metadata: { success: true, idempotent: true },
        });

        return {
          ...cachedResult,
          metadata: {
            ...cachedResult.metadata,
            executionTime: Date.now() - startTime,
            userId,
            traced: true,
            idempotent: true,
          },
        };
      }

      // Validate product exists and has stock
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, stockCount: true },
      });

      if (!product) {
        const errorResult: AddToCartResult = {
          success: false,
          error: 'Product not found',
          metadata: { executionTime: Date.now() - startTime, userId, traced: true },
        };

        span.end({
          level: 'ERROR',
          statusMessage: 'Product not found',
        });

        trace.end({
          output: { error: 'Product not found' },
          metadata: { success: false },
        });

        return errorResult;
      }

      if (product.stockCount < quantity) {
        const errorMsg = `Only ${product.stockCount} units in stock`;
        const errorResult: AddToCartResult = {
          success: false,
          error: errorMsg,
          metadata: { executionTime: Date.now() - startTime, userId, traced: true },
        };

        span.end({
          level: 'ERROR',
          statusMessage: errorMsg,
        });

        trace.end({
          output: { error: errorMsg },
          metadata: { success: false },
        });

        return errorResult;
      }

      // Get or create cart
      let cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId,
            items: [],
            total: 0,
            version: 1,
          },
        });
      }

      // Optimistic locking: retry on version mismatch
      const maxRetries = 3;
      let currentCart = cart;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const currentVersion = currentCart.version;

        // Parse items from JSONB
        const items = currentCart.items as CartItem[];

        // Find existing item or add new one
        const existingItem = items.find((item) => item.productId === productId);

        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          items.push({
            productId,
            quantity,
            price: product.price,
          });
        }

        // Calculate new total
        const newTotal = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        try {
          // Update cart with optimistic locking (version check)
          currentCart = await prisma.cart.update({
            where: { userId, version: currentVersion },
            data: {
              items,
              total: newTotal,
              version: currentVersion + 1,
            },
          });
          break; // Success - exit retry loop
        } catch (error: any) {
          // Prisma error code P2024 = optimistic locking failure
          if (error.code === 'P2024' || error.message?.includes('version')) {
            // Retry - fetch latest cart state
            if (attempt === maxRetries - 1) {
              throw new Error('Failed to update cart after multiple retries due to concurrent modifications');
            }
            currentCart = await prisma.cart.findUnique({ where: { userId } });
            if (!currentCart) {
              throw new Error('Cart not found during retry');
            }
            continue;
          }
          throw error;
        }
      }

      // Build success result
      const result: AddToCartResult = {
        success: true,
        data: { cart: { ...currentCart, items: currentCart.items as CartItem[] } },
        metadata: {
          executionTime: Date.now() - startTime,
          userId,
          traced: true,
          idempotent: true,
        },
      };

      // Cache result for idempotency (30 second TTL)
      await redis.setex(`idem:${idempotencyKey}`, 30, JSON.stringify(result));

      // End span with success metadata
      span.end({
        output: { cartId: currentCart.id, total: currentCart.total },
        metadata: { latency: Date.now() - startTime },
      });

      // End trace
      trace.end({
        output: { cart: currentCart },
        metadata: { success: true },
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Add to cart failed';

      // End span with error
      span.end({
        level: 'ERROR',
        statusMessage: errorMessage,
      });

      // End trace with error
      trace.end({
        output: { error: errorMessage },
        metadata: { success: false },
      });

      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime,
          userId,
          traced: true,
        },
      };
    }
  },
};
