/**
 * Cart Service with Proactive Abandonment Recovery
 *
 * Manages shopping cart operations with integrated proactive recovery.
 * Triggers cart abandonment events after 2 hours of inactivity.
 *
 * @file apps/web/lib/cart/service.ts
 */

import { prisma as db } from "@/lib/prisma";
import type { Cart, CartItem } from "@prisma/client";
import { triggerCartAbandonment } from "@/lib/events/trigger";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Cart with items relation
 */
export type CartWithItems = Cart & {
  items: CartItemWithProduct[];
};

/**
 * Cart item with product details
 */
export interface CartItemWithProduct extends CartItem {
  product: {
    id: number;
    name: string;
    price: number;
    image: string | null;
  };
}

/**
 * Cart update input
 */
export interface CartUpdate {
  items?: {
    productId: number;
    quantity: number;
  }[];
  couponCode?: string | null;
}

/**
 * Cart abandonment timeout handle
 * Stored to prevent duplicate triggers
 */
interface AbandonmentTimeout {
  timeoutId: NodeJS.Timeout;
  cartId: string;
  scheduledAt: Date;
}

// ============================================================================
// In-Memory Timeout Tracking
// ============================================================================

/**
 * Map of user IDs to their scheduled abandonment timeouts
 * Prevents duplicate timeout scheduling
 */
const abandonmentTimeouts = new Map<string, AbandonmentTimeout>();

/**
 * Cart abandonment delay in milliseconds
 * Default: 2 hours (7200000ms)
 */
const ABANDONMENT_DELAY_MS = 2 * 60 * 60 * 1000;

// ============================================================================
// Cart Operations
// ============================================================================

/**
 * Get or create a cart for a user
 *
 * @param customerId - The customer ID (user ID)
 * @returns Cart with items
 */
export async function getOrCreateCart(customerId: string): Promise<CartWithItems> {
  let cart = await db.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await db.cart.create({
      data: {
        customerId,
        items: { create: [] },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                image: true,
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

/**
 * Get cart by user ID
 *
 * @param customerId - The customer ID
 * @returns Cart with items or null
 */
export async function getCart(customerId: string): Promise<CartWithItems | null> {
  const cart = await db.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
            },
          },
        },
      },
    },
  });

  return cart;
}

/**
 * Add item to cart
 *
 * Updates quantity if item already exists.
 * Schedules abandonment check after update.
 *
 * @param customerId - The customer ID
 * @param productId - Product ID to add
 * @param quantity - Quantity to add (default: 1)
 * @returns Updated cart with items
 */
export async function addToCart(
  customerId: string,
  productId: number,
  quantity: number = 1
): Promise<CartWithItems> {
  const cart = await getOrCreateCart(customerId);

  // Check if item already exists
  const existingItem = cart.items.find((item) => item.productId === productId);

  if (existingItem) {
    // Update quantity
    await db.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity },
    });
  } else {
    // Add new item
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { price: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        price: product.price,
      },
    });
  }

  // Refresh cart
  const updatedCart = await getOrCreateCart(customerId);

  // Schedule abandonment check
  scheduleAbandonmentCheck(customerId, updatedCart);

  return updatedCart;
}

/**
 * Update cart item quantity
 *
 * @param customerId - The customer ID
 * @param productId - Product ID to update
 * @param quantity - New quantity (0 or less removes the item)
 * @returns Updated cart with items
 */
export async function updateCartItem(
  customerId: string,
  productId: number,
  quantity: number
): Promise<CartWithItems> {
  const cart = await getOrCreateCart(customerId);
  const item = cart.items.find((item) => item.productId === productId);

  if (!item) {
    throw new Error(`Item ${productId} not found in cart`);
  }

  if (quantity <= 0) {
    // Remove item
    await db.cartItem.delete({
      where: { id: item.id },
    });
  } else {
    // Update quantity
    await db.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
  }

  // Refresh cart
  const updatedCart = await getOrCreateCart(customerId);

  // Schedule or cancel abandonment check based on cart state
  if (updatedCart.items.length > 0) {
    scheduleAbandonmentCheck(customerId, updatedCart);
  } else {
    cancelAbandonmentCheck(customerId);
  }

  return updatedCart;
}

/**
 * Remove item from cart
 *
 * @param customerId - The customer ID
 * @param productId - Product ID to remove
 * @returns Updated cart with items
 */
export async function removeFromCart(
  customerId: string,
  productId: number
): Promise<CartWithItems> {
  return updateCartItem(customerId, productId, 0);
}

/**
 * Clear entire cart
 *
 * @param customerId - The customer ID
 */
export async function clearCart(customerId: string): Promise<void> {
  await db.cartItem.deleteMany({
    where: { cart: { customerId } },
  });

  // Cancel any scheduled abandonment check
  cancelAbandonmentCheck(customerId);
}

/**
 * Apply coupon code to cart
 *
 * @param customerId - The customer ID
 * @param couponCode - Coupon code to apply
 * @returns Updated cart
 */
export async function applyCoupon(
  customerId: string,
  couponCode: string
): Promise<CartWithItems> {
  const coupon = await db.coupon.findUnique({
    where: { code: couponCode },
  });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  if (!coupon.isActive) {
    throw new Error("Coupon is no longer active");
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new Error("Coupon has expired");
  }

  const cart = await getOrCreateCart(customerId);

  // Check minimum order amount
  if (coupon.minOrderAmount) {
    const cartTotal = calculateCartTotal(cart);
    if (cartTotal < coupon.minOrderAmount) {
      throw new Error(
        `Minimum order amount of ₹${coupon.minOrderAmount.toLocaleString("en-IN")} required`
      );
    }
  }

  const updatedCart = await db.cart.update({
    where: { id: cart.id },
    data: { couponCode },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
            },
          },
        },
      },
    },
  });

  return updatedCart;
}

/**
 * Complete checkout
 *
 * Marks cart as completed and cancels abandonment check.
 *
 * @param customerId - The customer ID
 * @returns Completed cart
 */
export async function completeCheckout(customerId: string): Promise<CartWithItems> {
  const cart = await getOrCreateCart(customerId);

  if (cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  // Clear coupon
  const updatedCart = await db.cart.update({
    where: { id: cart.id },
    data: { couponCode: null },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
            },
          },
        },
      },
    },
  });

  // Cancel abandonment check - checkout completed
  cancelAbandonmentCheck(customerId);

  // Clear cart items after successful checkout
  await clearCart(customerId);

  return updatedCart;
}

// ============================================================================
// Cart Abandonment Scheduling
// ============================================================================

/**
 * Schedule cart abandonment check
 *
 * Sets a timeout to trigger cart abandonment event after 2 hours.
 * Cancels any existing timeout for this user.
 *
 * @param customerId - The customer ID
 * @param cart - Current cart state
 */
function scheduleAbandonmentCheck(customerId: string, cart: CartWithItems): void {
  // Cancel existing timeout
  cancelAbandonmentCheck(customerId);

  // Don't schedule for empty carts
  if (cart.items.length === 0) {
    return;
  }

  // Calculate cart total
  const cartTotal = calculateCartTotal(cart);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Schedule abandonment trigger
  const timeoutId = setTimeout(async () => {
    try {
      // Check if cart still has items and checkout not completed
      const currentCart = await getCart(customerId);

      if (currentCart && currentCart.items.length > 0) {
        // Get product names for personalization
        const productNames = currentCart.items.map((item) => item.product.name);

        // Trigger abandonment event
        await triggerCartAbandonment(
          customerId,
          currentCart.id,
          cartTotal,
          itemCount,
          productNames
        );

        console.log(
          `[Cart Abandonment] Triggered for user ${customerId}, cart ${currentCart.id}`
        );
      }
    } catch (error) {
      console.error(`[Cart Abandonment] Error triggering for user ${customerId}:`, error);
    } finally {
      // Clean up timeout map
      abandonmentTimeouts.delete(customerId);
    }
  }, ABANDONMENT_DELAY_MS);

  // Store timeout reference
  abandonmentTimeouts.set(customerId, {
    timeoutId,
    cartId: cart.id,
    scheduledAt: new Date(),
  });

  console.log(
    `[Cart Abandonment] Scheduled for user ${customerId} in ${ABANDONMENT_DELAY_MS / 1000 / 60} minutes`
  );
}

/**
 * Cancel scheduled cart abandonment check
 *
 * Called when cart is cleared or checkout is completed.
 *
 * @param customerId - The customer ID
 */
function cancelAbandonmentCheck(customerId: string): void {
  const timeout = abandonmentTimeouts.get(customerId);

  if (timeout) {
    clearTimeout(timeout.timeoutId);
    abandonmentTimeouts.delete(customerId);

    console.log(`[Cart Abandonment] Cancelled for user ${customerId}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate cart total
 *
 * @param cart - Cart with items
 * @returns Total in cents
 */
export function calculateCartTotal(cart: CartWithItems): number {
  return cart.items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

/**
 * Get cart item count
 *
 * @param cart - Cart with items
 * @returns Total number of items
 */
export function getCartItemCount(cart: CartWithItems): number {
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

/**
 * Get abandonment timeout status
 *
 * @param customerId - The customer ID
 * @returns Timeout info or null
 */
export function getAbandonmentTimeoutStatus(
  customerId: string
): AbandonmentTimeout | null {
  return abandonmentTimeouts.get(customerId) || null;
}
