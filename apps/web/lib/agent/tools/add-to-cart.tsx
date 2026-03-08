"use server";

/**
 * Add to Cart Tool - Idempotent Cart Operations
 *
 * Handles adding products to user's shopping cart with idempotency protection.
 * Prevents double-adds when users click rapidly or retry failed requests.
 *
 * Key features:
 * - 30-second idempotency window via Redis
 * - Atomic cart operations
 * - Real-time cart state updates
 * - CartCanvas component rendering
 * - **COMPACT SUMMARY**: Stores ~50 token summary in AIState, not full cart object
 *
 * Flow:
 * 1. User requests to add product
 * 2. Generate idempotency key from userId + productId + quantity
 * 3. Check Redis for existing operation (within 30s window)
 * 4. If cached → return existing cart state
 * 5. If new → execute add-to-cart and cache result
 *
 * @file lib/agent/tools/add-to-cart.tsx
 */

import { z } from "zod";
import { CartCanvas } from "@/components/genui/CartCanvas";
import { ProductGrid } from "@/components/genui/ProductGrid";
import { ActionConfirm } from "@/components/genui/ActionConfirm";
import {
  withIdempotency,
  generateCartIdempotencyKey,
  type IdempotencyResult,
} from "@/lib/redis/idempotency";
import { generateToolSummary, type CartSummaryData } from "./summarizer";
import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/search/hybrid";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for Add to Cart Parameters
// ============================================================================

/**
 * Add to cart parameters schema
 *
 * The LLM extracts these parameters from natural language requests.
 * Example: "Add 2 Sony headphones to my cart"
 * → { productId: "prod_123", quantity: 2 }
 */
export const AddToCartParams = z.object({
  productId: z.string().describe("Product ID to add to cart (e.g., prod_123)"),
  quantity: z
    .number()
    .int()
    .positive()
    .max(10)
    .default(1)
    .describe("Quantity to add (max 10 per request)"),
});

export type AddToCartParams = z.infer<typeof AddToCartParams>;

// ============================================================================
// Cart Service Types
// ============================================================================

/**
 * Cart item representation
 */
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  inStock: boolean;
}

/**
 * Shopping cart state
 */
export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  itemCount: number;
  updatedAt: Date;
  summary?: string; // Compact summary for AIState (~50 tokens)
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Add to cart tool configuration
 *
 * This tool handles the complete add-to-cart flow with idempotency:
 * 1. Yields intermediate "Adding to cart..." state
 * 2. Generates idempotency key from user + product + quantity
 * 3. Executes with Redis-based idempotency protection (30s window)
 * 4. Returns CartCanvas component with updated cart
 */
export const addToCartTool = {
  description:
    "Add a product to the user's shopping cart. Prevents duplicate adds within 30 seconds using idempotency protection.",
  parameters: AddToCartParams,
  generate: async function* (
    params: AddToCartParams,
    options?: { userId?: string }
  ) {
    // Validate userId is available
    const userId = options?.userId;
    if (!userId) {
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Authentication Required
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Please log in to add items to your cart.
          </p>
        </div>
      );
    }

    yield <div>Checking product availability...</div>;

    // ALWAYS verify product exists before acting
    const product = await prisma.product.findUnique({
      where: { id: parseInt(params.productId) || 0 },
      select: { id: true, name: true, stock: true, price: true, image: true },
    });

    if (!product) {
      // Don't silently fail — suggest alternatives
      const similar = await hybridSearch({
        query: "products",
        context: "product_search",
        options: { limit: 3 },
      });

      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Product Not Found
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              I couldn't find that exact product (ID: {params.productId}). Did you mean one of these?
            </p>
          </div>
          <ProductGrid products={similar.results.map((r) => r.item as any)} />
        </div>
      );
    }

    // Check stock
    if (product.stock < params.quantity) {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Limited Stock
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Only {product.stock} units of {product.name} available.
            </p>
          </div>
          <ActionConfirm
            action="Add to Cart"
            detail={`${product.stock} × ${product.name}`}
            onConfirm={() => addToCartMCP(userId, String(product.id), product.stock)}
          />
        </div>
      );
    }

    // Only proceed if product is real and in stock
    yield <div>Adding {product.name} to cart...</div>;

    // Generate idempotency key
    const idempotencyKey = generateCartIdempotencyKey(
      userId,
      params.productId,
      params.quantity
    );

    try {
      // Execute with idempotency protection (30-second window)
      const result: IdempotencyResult<Cart> = await withIdempotency(
        idempotencyKey,
        async () => await addToCartMCP(userId, params.productId, params.quantity),
        {
          ttlSeconds: 30,
          logOperations: true,
        }
      );

      // Log if this was a cached result (duplicate request)
      if (result.isCached) {
        console.log(
          `[AddToCart] Returning cached result (duplicate request within 30s). Key: ${idempotencyKey}`
        );
      }

      // Generate compact summary for AIState storage (~50 tokens vs 500+)
      // Full cart object goes to UI component only, summary goes to AIState
      const addedItem = result.data.items.find((item) => item.productId === params.productId) || {
        productId: params.productId,
        name: `Product ${params.productId}`,
        quantity: params.quantity,
      };
      const summary = generateToolSummary('addToCart', [result.data, addedItem]);

      // Log summary for debugging (optional)
      console.log(`[AddToCart] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

      // Return CartCanvas with updated cart
      // Note: The full cart object is passed to the component, but only the summary
      // should be stored in AIState by the calling code
      return <CartCanvas cart={result.data} summary={summary.summary} />;
    } catch (error) {
      console.error("[AddToCart] Error adding to cart:", error);
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Failed to Add to Cart
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error instanceof Error ? error.message : "Please try again"}
          </p>
        </div>
      );
    }
  },
};

// ============================================================================
// Cart Service Implementation
// ============================================================================

/**
 * Add product to cart (MCP-style service call)
 *
 * Validates product exists and is in stock before adding to cart.
 * Uses Prisma for database operations.
 *
 * @param userId - User identifier
 * @param productId - Product ID to add
 * @param quantity - Quantity to add
 * @returns Updated cart object
 *
 * @example
 * ```typescript
 * const cart = await addToCartMCP('user_123', 'prod_456', 2);
 * // Returns cart with updated items
 * ```
 */
async function addToCartMCP(
  userId: string,
  productId: string,
  quantity: number
): Promise<Cart> {
  // Validate product exists in database
  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) || 0 },
    select: { id: true, name: true, price: true, stock: true, image: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  if (!product || product.stock <= 0) {
    throw new Error(`Product out of stock: ${product?.name || productId}`);
  }

  // Use cart service for actual cart operations
  const { addToCart } = await import("@/lib/cart/service");
  const updatedCart = await addToCart(userId, product.id, quantity);

  // Convert Prisma cart to our Cart type
  // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
  return {
    id: updatedCart.id,
    customerId: updatedCart.customerId,
    items: updatedCart.items.map((item) => ({
      id: item.id,
      productId: String(item.productId),
      name: sanitizeForLLMContext(item.product.name),
      price: item.price,
      quantity: item.quantity,
      image: item.product.image || undefined,
      inStock: true,
    })),
    subtotal: updatedCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    total: updatedCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    itemCount: updatedCart.items.reduce((sum, item) => sum + item.quantity, 0),
    updatedAt: updatedCart.updatedAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get cart by user ID (helper for future operations)
 *
 * @param userId - User identifier
 * @returns User's cart or null if not found
 */
export async function getCartByUserId(userId: string): Promise<Cart | null> {
  // Use cart service for actual cart operations
  const { getCart } = await import("@/lib/cart/service");
  const prismaCart = await getCart(userId);

  if (!prismaCart) {
    return null;
  }

  // Convert Prisma cart to our Cart type
  // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
  return {
    id: prismaCart.id,
    customerId: prismaCart.customerId,
    items: prismaCart.items.map((item) => ({
      id: item.id,
      productId: String(item.productId),
      name: sanitizeForLLMContext(item.product.name),
      price: item.price,
      quantity: item.quantity,
      image: item.product.image || undefined,
      inStock: true,
    })),
    subtotal: prismaCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    total: prismaCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    itemCount: prismaCart.items.reduce((sum, item) => sum + item.quantity, 0),
    updatedAt: prismaCart.updatedAt,
  };
}

export default addToCartTool;
