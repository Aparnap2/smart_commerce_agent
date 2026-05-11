import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

export const createMCPRegistry = (db: PrismaClient) => {
  const mcp = new Hono();

  // Health check
  mcp.get('/health', (c) => c.json({ status: 'ok', service: 'mcp' }));

  // List available tools
  mcp.get('/tools', (c) => {
    const tools = [
      {
        name: 'get_order',
        description: 'Get a specific order by ID',
        endpoint: '/mcp/tool/get_order',
        method: 'POST',
        parameters: {
          orderId: 'number (required)',
          userId: 'string (required)',
        },
      },
      {
        name: 'get_purchase_requests',
        description: 'Get purchase requests for a user',
        endpoint: '/mcp/tool/get_purchase_requests',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          status: 'enum [pending, processing, shipped, delivered, cancelled] (optional)',
          limit: 'number (default: 20)',
          offset: 'number (default: 0)',
        },
      },
      {
        name: 'get_product',
        description: 'Get a product by ID',
        endpoint: '/mcp/tool/get_product',
        method: 'POST',
        parameters: {
          productId: 'number (required)',
        },
      },
      {
        name: 'search_catalog',
        description: 'Search catalog by query',
        endpoint: '/mcp/tool/search_catalog',
        method: 'POST',
        parameters: {
          query: 'string (required)',
          category: 'string (optional)',
          minPrice: 'number (optional)',
          maxPrice: 'number (optional)',
          inStock: 'boolean (optional)',
          limit: 'number (default: 10, max: 50)',
        },
      },
      {
        name: 'create_refund',
        description: 'Create a refund for an order',
        endpoint: '/mcp/tool/create_refund',
        method: 'POST',
        parameters: {
          orderId: 'number (required)',
          userId: 'string (required)',
          reason: 'enum [defective, not_as_described, wrong_item, changed_mind, other] (required)',
          reasonDescription: 'string (optional)',
          amount: 'number (optional)',
        },
      },
      {
        name: 'get_cart',
        description: 'Get cart contents',
        endpoint: '/mcp/tool/get_cart',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          cartId: 'string (optional)',
        },
      },
      {
        name: 'add_to_pr',
        description: 'Add a product to purchase request',
        endpoint: '/mcp/tool/add_to_pr',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          productId: 'number (required)',
          quantity: 'number (default: 1)',
        },
      },
      {
        name: 'create_support_ticket',
        description: 'Create a support ticket',
        endpoint: '/mcp/tool/create_support_ticket',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          orderId: 'number (optional)',
          subject: 'string (required)',
          description: 'string (required)',
          category: 'enum [order_status, shipping, return, refund, product_info, payment, account, technical, other] (required)',
          priority: 'enum [low, medium, high, urgent] (default: medium)',
        },
      },
      {
        name: 'orders.create_from_cart',
        description: 'Create an order from cart',
        endpoint: '/mcp/tool/orders.create_from_cart',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          cartId: 'string (required)',
        },
      },
      {
        name: 'orders.cancel',
        description: 'Cancel an order',
        endpoint: '/mcp/tool/orders.cancel',
        method: 'POST',
        parameters: {
          userId: 'string (required)',
          orderId: 'number (required)',
        },
      },
    ];

    return c.json({ tools });
  });

  // Get order tool (renamed from get_order to get_purchase_requests)
  mcp.post(
    '/tool/get_purchase_request',
    zValidator(
      'json',
      z.object({
        orderId: z.coerce.number(),
        userId: z.string(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { orderId, userId } = body;

      try {
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: { product: true, customer: true },
        });

        if (!order || order.customerId !== parseInt(userId)) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }

        return c.json({ success: true, data: order });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // List purchase requests tool (renamed from list_orders)
  mcp.post(
    '/tool/get_purchase_requests',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, status, limit, offset } = body;

      try {
        const where: Record<string, unknown> = { customerId: parseInt(userId) };
        if (status) where.status = status;

        const orders = await db.order.findMany({
          where,
          take: limit,
          skip: offset,
          include: { product: true },
          orderBy: { orderDate: 'desc' },
        });

        return c.json({
          success: true,
          data: {
            orders,
            count: orders.length,
            hasMore: orders.length === limit,
          },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Get product tool
  mcp.post(
    '/tool/get_product',
    zValidator(
      'json',
      z.object({
        productId: z.coerce.number(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { productId } = body;

      try {
        const product = await db.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          return c.json({ success: false, error: 'Product not found' }, 404);
        }

        return c.json({ success: true, data: product });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Search catalog tool (renamed from search_products)
  mcp.post(
    '/tool/search_catalog',
    zValidator(
      'json',
      z.object({
        query: z.string().min(1),
        category: z.string().optional(),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().nonnegative().optional(),
        inStock: z.boolean().optional(),
        limit: z.number().int().positive().max(50).default(10),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { query, category, minPrice, maxPrice, inStock, limit } = body;

      try {
        const where: Record<string, unknown> = {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        };

        if (category) where.category = category;

        if (minPrice !== undefined || maxPrice !== undefined) {
          where.price = {};
          if (minPrice !== undefined) (where.price as Record<string, number>).gte = minPrice;
          if (maxPrice !== undefined) (where.price as Record<string, number>).lte = maxPrice;
        }

        if (inStock !== undefined) {
          where.stock = inStock ? { gt: 0 } : { equals: 0 };
        }

        const products = await db.product.findMany({ where, take: limit });

        return c.json({
          success: true,
          data: { products, query, count: products.length },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Create refund tool
  mcp.post(
    '/tool/create_refund',
    zValidator(
      'json',
      z.object({
        orderId: z.coerce.number(),
        userId: z.string(),
        reason: z.enum(['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other']),
        reasonDescription: z.string().optional(),
        amount: z.number().positive().optional(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { orderId, userId, reason, reasonDescription, amount } = body;

      try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order || order.customerId !== parseInt(userId)) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }

        const refund = await db.refund.create({
          data: {
            stripeRefundId: `refund_${Date.now()}`,
            paymentIntentId: `pi_${Date.now()}`,
            orderId,
            customerEmail: '',
            amount: amount ?? Math.floor(order.total * 100),
            currency: 'usd',
            status: 'pending',
            reason,
          },
        });

        return c.json({ success: true, data: refund });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Get cart tool
  mcp.post(
    '/tool/get_cart',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        cartId: z.string().optional(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, cartId } = body;

      try {
        const cart = await db.cart.findUnique({
          where: { id: cartId || userId },
          include: { items: { include: { product: true } } },
        });

        if (!cart) {
          return c.json({
            success: true,
            data: {
              cartId: userId,
              items: [],
              subtotal: 0,
              total: 0,
            },
          });
        }

        const items = cart.items.map((item) => ({
          productId: item.product.id.toString(),
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
        }));

        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        return c.json({
          success: true,
          data: {
            cartId: cart.id,
            items,
            subtotal,
            total: subtotal,
          },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Add to PR tool (renamed from add_to_cart)
  mcp.post(
    '/tool/add_to_pr',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        productId: z.coerce.number(),
        quantity: z.number().int().positive().default(1),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, productId, quantity } = body;

      try {
        const product = await db.product.findUnique({ where: { id: productId } });
        if (!product) {
          return c.json({ success: false, error: 'Product not found' }, 404);
        }

        let cart = await db.cart.findUnique({ where: { id: userId } });
        if (!cart) {
          cart = await db.cart.create({
            data: { id: userId, customerId: userId },
          });
        }

        await db.cartItem.upsert({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId,
            },
          },
          update: { quantity: { increment: quantity } },
          create: {
            cartId: cart.id,
            productId,
            quantity,
            price: product.price,
          },
        });

        return c.json({
          success: true,
          data: { cartId: cart.id, productId: productId.toString(), quantity },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Create support ticket tool
  mcp.post(
    '/tool/create_support_ticket',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        orderId: z.coerce.number().optional(),
        subject: z.string().min(1).max(500),
        description: z.string().min(1).max(10000),
        category: z.enum(['order_status', 'shipping', 'return', 'refund', 'product_info', 'payment', 'account', 'technical', 'other']),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, orderId, subject, description, category, priority } = body;

      try {
        const ticket = await db.supportTicket.create({
          data: {
            customerId: parseInt(userId),
            relatedOrderId: orderId || null,
            issue: `${subject}: ${description}`,
            status: 'open',
            priority,
          },
        });

        return c.json({ success: true, data: ticket });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Create order from cart tool
  mcp.post(
    '/tool/orders.create_from_cart',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        cartId: z.string(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, cartId } = body;

      try {
        const cart = await db.cart.findUnique({
          where: { id: cartId },
          include: { items: { include: { product: true } } },
        });

        if (!cart || cart.customerId !== userId) {
          return c.json({ success: false, error: 'Cart not found' }, 404);
        }

        if (!cart.items || cart.items.length === 0) {
          return c.json({ success: false, error: 'Cart is empty' }, 400);
        }

        const firstItem = cart.items[0];
        const order = await db.order.create({
          data: {
            customerId: parseInt(userId),
            productId: firstItem.productId,
            total: firstItem.price * firstItem.quantity,
            status: 'confirmed',
            quantity: firstItem.quantity,
          },
        });

        await db.cartItem.deleteMany({ where: { cartId } });
        await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });

        return c.json({
          success: true,
          data: {
            orderId: order.id.toString(),
            cartId,
            status: 'confirmed',
            itemCount: cart.items.length,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  // Cancel order tool
  mcp.post(
    '/tool/orders.cancel',
    zValidator(
      'json',
      z.object({
        userId: z.string(),
        orderId: z.coerce.number(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const { userId, orderId } = body;

      try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order || order.customerId !== parseInt(userId)) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }

        if (order.status === 'shipped' || order.status === 'delivered') {
          return c.json(
            { success: false, error: `Cannot cancel order that has been ${order.status}` },
            400
          );
        }

        await db.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });

        return c.json({
          success: true,
          data: {
            orderId: orderId.toString(),
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        return c.json({ success: false, error: (error as Error).message }, 500);
      }
    }
  );

  return mcp;
};
