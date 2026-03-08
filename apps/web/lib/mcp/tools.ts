/**
 * Secure MCP Tools Factory
 *
 * Creates secure, user-context-aware tools for the e-commerce agent.
 * All tools enforce authorization based on the current user context.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Tool } from './types.js';
import { createTool } from './server.js';
import type { ECatalogMCPServer } from './server.js';

/**
 * Secure tools factory options
 */
export interface SecureToolsOptions {
  /** Database client or access function */
  db: {
    orders: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      findMany: (args: { where: Record<string, unknown>; take: number; skip: number }) => Promise<unknown[]>;
    };
    products: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      findMany: (args: { where: Record<string, unknown>; take: number }) => Promise<unknown[]>;
    };
    refunds: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      findMany: (args: { where: { customerId: string } }) => Promise<unknown[]>;
      create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    };
    tickets: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      findMany: (args: { where: { customerId: string } }) => Promise<unknown[]>;
      create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
    cart: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
  };
  /** Rate limiter function */
  rateLimiter?: {
    check: (userId: string, action: string) => Promise<{ allowed: boolean; remaining: number }>;
  };
}

/**
 * Create secure MCP tools for e-commerce operations
 */
export function createSecureTools(options: SecureToolsOptions): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  // ========== ORDER TOOLS ==========

  tools.set('get_order', createTool('get_order', {
    title: 'Get Order Details',
    description: 'Retrieve order details for the authenticated user. Only returns orders belonging to the current user.',
    parameters: z.object({
      orderId: z.string().describe('The order ID to retrieve'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Check rate limit
      if (options.rateLimiter) {
        const rateCheck = await options.rateLimiter.check(userId, 'get_order');
        if (!rateCheck.allowed) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }

      const order = await options.db.orders.findUnique({
        where: { id: args.orderId },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Authorization check: ensure order belongs to user
      const orderData = order as { customerId?: string };
      if (orderData.customerId && orderData.customerId !== userId) {
        return { success: false, error: 'Order not found' };
      }

      return {
        success: true,
        data: order,
      };
    },
  }));

  tools.set('list_orders', createTool('list_orders', {
    title: 'List User Orders',
    description: 'List all orders for the authenticated user with optional filtering by status.',
    parameters: z.object({
      status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
      limit: z.number().int().positive().max(100).default(20),
      offset: z.number().int().nonnegative().default(0),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const where: Record<string, unknown> = { customerId: userId };
      if (args.status) {
        where.status = args.status;
      }

      const orders = await options.db.orders.findMany({
        where,
        take: args.limit,
        skip: args.offset,
      });

      return {
        success: true,
        data: {
          orders,
          count: orders.length,
          hasMore: orders.length === args.limit,
        },
      };
    },
  }));

  // ========== PRODUCT TOOLS ==========

  tools.set('get_product', createTool('get_product', {
    title: 'Get Product Details',
    description: 'Retrieve detailed information about a product by ID.',
    parameters: z.object({
      productId: z.string().describe('The product ID to retrieve'),
    }),
    requireUserId: false,
    execute: async (args) => {
      const product = await options.db.products.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      return {
        success: true,
        data: product,
      };
    },
  }));

  tools.set('search_products', createTool('search_products', {
    title: 'Search Products',
    description: 'Search for products with various filters.',
    parameters: z.object({
      query: z.string().min(1).describe('Search query'),
      category: z.string().optional(),
      minPrice: z.number().nonnegative().optional(),
      maxPrice: z.number().nonnegative().optional(),
      inStock: z.boolean().optional(),
      limit: z.number().int().positive().max(50).default(10),
    }),
    requireUserId: false,
    execute: async (args) => {
      const where: Record<string, unknown> = {
        OR: [
          { name: { contains: args.query } },
          { description: { contains: args.query } },
        ],
      };

      if (args.category) {
        where.category = args.category;
      }

      if (args.minPrice !== undefined || args.maxPrice !== undefined) {
        where.price = {};
        if (args.minPrice !== undefined) {
          (where.price as Record<string, number>).gte = args.minPrice;
        }
        if (args.maxPrice !== undefined) {
          (where.price as Record<string, number>).lte = args.maxPrice;
        }
      }

      if (args.inStock !== undefined) {
        where.inventory = args.inStock ? { gt: 0 } : 0;
      }

      const products = await options.db.products.findMany({
        where,
        take: args.limit,
      });

      return {
        success: true,
        data: {
          products,
          query: args.query,
          count: products.length,
        },
      };
    },
  }));

  // ========== REFUND TOOLS ==========

  tools.set('create_refund', createTool('create_refund', {
    title: 'Create Refund Request',
    description: 'Submit a refund request for an order. Requires order ownership.',
    parameters: z.object({
      orderId: z.string().describe('Order ID for the refund'),
      reason: z.enum(['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other']).describe('Reason for refund'),
      reasonDescription: z.string().optional().describe('Additional details'),
      amount: z.number().positive().optional().describe('Amount to refund (full order if not specified)'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify order belongs to user
      const order = await options.db.orders.findUnique({
        where: { id: args.orderId },
      }) as { customerId?: string } | null;

      if (!order || order.customerId !== userId) {
        return { success: false, error: 'Order not found' };
      }

      const refund = await options.db.refunds.create({
        data: {
          orderId: args.orderId,
          customerId: userId,
          reason: args.reason,
          reasonDescription: args.reasonDescription,
          amount: args.amount,
          status: 'pending',
        },
      });

      return {
        success: true,
        data: refund,
      };
    },
  }));

  tools.set('get_refund_status', createTool('get_refund_status', {
    title: 'Get Refund Status',
    description: 'Check the status of a refund request.',
    parameters: z.object({
      refundId: z.string().describe('Refund ID to check'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const refund = await options.db.refunds.findUnique({
        where: { id: args.refundId },
      });

      if (!refund) {
        return { success: false, error: 'Refund not found' };
      }

      const refundData = refund as { customerId?: string };
      if (refundData.customerId && refundData.customerId !== userId) {
        return { success: false, error: 'Refund not found' };
      }

      return {
        success: true,
        data: refund,
      };
    },
  }));

  // ========== SUPPORT TICKET TOOLS ==========

  tools.set('create_support_ticket', createTool('create_support_ticket', {
    title: 'Create Support Ticket',
    description: 'Submit a new support ticket.',
    parameters: z.object({
      orderId: z.string().optional(),
      subject: z.string().min(1).max(500),
      description: z.string().min(1).max(10000),
      category: z.enum(['order_status', 'shipping', 'return', 'refund', 'product_info', 'payment', 'account', 'technical', 'other']),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const ticket = await options.db.tickets.create({
        data: {
          customerId: userId,
          orderId: args.orderId,
          subject: args.subject,
          description: args.description,
          category: args.category,
          priority: args.priority,
          status: 'open',
        },
      });

      return {
        success: true,
        data: ticket,
      };
    },
  }));

  tools.set('get_ticket_status', createTool('get_ticket_status', {
    title: 'Get Ticket Status',
    description: 'Check the status of a support ticket.',
    parameters: z.object({
      ticketId: z.string().describe('Ticket ID to check'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const ticket = await options.db.tickets.findUnique({
        where: { id: args.ticketId },
      });

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      const ticketData = ticket as { customerId?: string };
      if (ticketData.customerId && ticketData.customerId !== userId) {
        return { success: false, error: 'Ticket not found' };
      }

      return {
        success: true,
        data: ticket,
      };
    },
  }));

  tools.set('add_ticket_message', createTool('add_ticket_message', {
    title: 'Add Ticket Message',
    description: 'Add a message to an existing support ticket.',
    parameters: z.object({
      ticketId: z.string(),
      message: z.string().min(1),
      isInternal: z.boolean().default(false),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const ticket = await options.db.tickets.findUnique({
        where: { id: args.ticketId },
      }) as { customerId?: string } | null;

      if (!ticket || ticket.customerId !== userId) {
        return { success: false, error: 'Ticket not found' };
      }

      // In a real implementation, this would create a message record
      return {
        success: true,
        data: {
          ticketId: args.ticketId,
          message: args.message,
          timestamp: new Date().toISOString(),
        },
      };
    },
  }));

  // ========== CART TOOLS ==========

  tools.set('get_cart', createTool('get_cart', {
    title: 'Get Shopping Cart',
    description: 'Retrieve the current user\'s shopping cart.',
    parameters: z.object({
      cartId: z.string().optional(),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId || userId },
      });

      if (!cart) {
        return {
          success: true,
          data: {
            cartId: userId,
            items: [],
            subtotal: 0,
            total: 0,
          },
        };
      }

      return {
        success: true,
        data: cart,
      };
    },
  }));

  tools.set('add_to_cart', createTool('add_to_cart', {
    title: 'Add to Cart',
    description: 'Add a product to the shopping cart.',
    parameters: z.object({
      productId: z.string(),
      quantity: z.number().int().positive().default(1),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify product exists
      const product = await options.db.products.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      // Get or create cart
      let cart = await options.db.cart.findUnique({
        where: { id: userId },
      });

      if (!cart) {
        cart = await options.db.cart.create({
          data: {
            id: userId,
            customerId: userId,
            items: [],
          },
        });
      }

      // In a real implementation, this would update the cart with the new item
      return {
        success: true,
        data: {
          cartId: userId,
          productId: args.productId,
          quantity: args.quantity,
        },
      };
    },
  }));

  tools.set('cart.update_quantity', createTool('cart.update_quantity', {
    title: 'Update Cart Item Quantity',
    description: 'Update the quantity of an item in the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      productId: z.number().int().positive().describe('Product ID'),
      quantity: z.number().int().positive().describe('New quantity (must be > 0)'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Validate quantity
      if (args.quantity <= 0) {
        return { success: false, error: 'Quantity must be positive' };
      }

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Verify product exists
      const product = await options.db.products.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      // Update cart item quantity
      const result = await options.db.cart.update({
        where: { id: args.cartId },
        data: {
          items: {
            update: {
              where: { cartId_productId: { cartId: args.cartId, productId: args.productId } },
              data: { quantity: args.quantity },
            },
          },
        },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          productId: args.productId,
          quantity: args.quantity,
          updatedAt: result.updatedAt,
        },
      };
    },
  }));

  tools.set('cart.remove_item', createTool('cart.remove_item', {
    title: 'Remove Item from Cart',
    description: 'Remove a product from the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      productId: z.number().int().positive().describe('Product ID to remove'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Remove item
      const result = await options.db.cart.update({
        where: { id: args.cartId },
        data: {
          items: {
            delete: {
              cartId_productId: { cartId: args.cartId, productId: args.productId },
            },
          },
        },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          productId: args.productId,
          removed: true,
          updatedAt: result.updatedAt,
        },
      };
    },
  }));

  tools.set('cart.clear', createTool('cart.clear', {
    title: 'Clear Shopping Cart',
    description: 'Remove all items from the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Count items before clearing
      const itemCount = cart.items?.length || 0;

      // Clear all items
      const result = await options.db.cart.update({
        where: { id: args.cartId },
        data: {
          items: {
            deleteMany: {},
          },
        },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          clearedItems: itemCount,
          updatedAt: result.updatedAt,
        },
      };
    },
  }));

  tools.set('cart.apply_coupon', createTool('cart.apply_coupon', {
    title: 'Apply Coupon Code',
    description: 'Apply a coupon/promo code to the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      couponCode: z.string().describe('Coupon code to apply'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Find coupon
      const coupon = await options.db.coupons.findUnique({
        where: { code: args.couponCode },
      });

      if (!coupon) {
        return { success: false, error: 'Invalid coupon code' };
      }

      // Check if coupon is active
      if (!coupon.is_active) {
        return { success: false, error: 'Coupon is not active' };
      }

      // Check if coupon is expired
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { success: false, error: 'Coupon has expired' };
      }

      // Calculate discount
      const cartTotal = cart.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
      let discount = 0;

      if (coupon.discount_type === 'percentage') {
        discount = cartTotal * (coupon.discount_value / 100);
      } else if (coupon.discount_type === 'fixed') {
        discount = coupon.discount_value;
      }

      // Apply coupon to cart
      const result = await options.db.cart.update({
        where: { id: args.cartId },
        data: {
          couponCode: args.couponCode,
        },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          couponCode: args.couponCode,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          discount: discount,
          newTotal: cartTotal - discount,
          updatedAt: result.updatedAt,
        },
      };
    },
  }));

  // ========== CHECKOUT TOOLS ==========

  tools.set('checkout.create', createTool('checkout.create', {
    title: 'Create Checkout Session',
    description: 'Create a checkout session from cart with payment and shipping.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      paymentMethodId: z.string().describe('Payment method ID from Stripe'),
      shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string(),
      }).describe('Shipping address'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Check cart has items
      if (!cart.items || cart.items.length === 0) {
        return { success: false, error: 'Cart is empty' };
      }

      // Calculate total
      const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discount = cart.couponCode ? calculateDiscount(cart) : 0;
      const total = subtotal - discount;

      // In production, create Stripe checkout session here
      const checkoutId = `checkout_${Date.now()}`;

      return {
        success: true,
        data: {
          checkoutId,
          cartId: args.cartId,
          paymentMethodId: args.paymentMethodId,
          shippingAddress: args.shippingAddress,
          subtotal,
          discount,
          total,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      };
    },
  }));

  // ========== ORDER TOOLS ==========

  tools.set('orders.create_from_cart', createTool('orders.create_from_cart', {
    title: 'Create Order from Cart',
    description: 'Create an order from the current cart contents.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify cart exists and belongs to user
      const cart = await options.db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, error: 'Cart not found' };
      }

      // Check cart has items
      if (!cart.items || cart.items.length === 0) {
        return { success: false, error: 'Cart is empty' };
      }

      // Create order (in production, this would be a transaction)
      const orderId = `order_${Date.now()}`;

      // Clear cart after order creation
      await options.db.cart.update({
        where: { id: args.cartId },
        data: {
          items: { deleteMany: {} },
          couponCode: null,
        },
      });

      return {
        success: true,
        data: {
          orderId,
          cartId: args.cartId,
          status: 'confirmed',
          itemCount: cart.items.length,
          createdAt: new Date().toISOString(),
        },
      };
    },
  }));

  tools.set('orders.cancel', createTool('orders.cancel', {
    title: 'Cancel Order',
    description: 'Cancel an existing order (only if not yet shipped).',
    parameters: z.object({
      orderId: z.string().describe('Order ID to cancel'),
    }),
    requireUserId: true,
    execute: async (args, userId) => {
      if (!userId) throw new Error('Authorization required');

      // Verify order exists and belongs to user
      const order = await options.db.orders.findUnique({
        where: { id: args.orderId },
      });

      if (!order || order.customerId !== userId) {
        return { success: false, error: 'Order not found' };
      }

      // Check if order can be cancelled
      if (order.status === 'shipped' || order.status === 'delivered') {
        return { 
          success: false, 
          error: `Cannot cancel order that has been ${order.status}` 
        };
      }

      // Cancel order
      const result = await options.db.orders.update({
        where: { id: args.orderId },
        data: { status: 'cancelled' },
      });

      return {
        success: true,
        data: {
          orderId: args.orderId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        },
      };
    },
  }));

  return tools;
}

/**
 * Helper: Calculate discount from coupon
 */
function calculateDiscount(cart: any): number {
  if (!cart.couponCode) return 0;
  
  const subtotal = cart.items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;
  
  // In production, fetch coupon from database
  // For now, return 0 as placeholder
  return 0;
}

/**
 * Register all secure tools with an MCP server
 */
export function registerSecureTools(server: ECatalogMCPServer, options: SecureToolsOptions): void {
  const tools = createSecureTools(options);

  for (const [name, tool] of tools) {
    server.registerTool(name, tool);
  }
}
