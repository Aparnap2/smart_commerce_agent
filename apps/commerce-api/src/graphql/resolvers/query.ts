import { PrismaClient } from '@prisma/client';

export const queryResolvers = (db: PrismaClient) => ({
  // Order queries
  getOrder: async (_: unknown, args: { orderId: number }, context: { userId: string | null }) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, order: null, error: 'Authorization required' };
    }

    try {
      const order = await db.order.findUnique({
        where: { id: args.orderId },
        include: { product: true, customer: true },
      });

      if (!order) {
        return { success: false, order: null, error: 'Order not found' };
      }

      if (order.customerId !== parseInt(userId)) {
        return { success: false, order: null, error: 'Order not found' };
      }

      return { success: true, order, error: null };
    } catch (error) {
      return { success: false, order: null, error: (error as Error).message };
    }
  },

  listOrders: async (
    _: unknown,
    args: { status?: string; limit?: number; offset?: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const where: Record<string, unknown> = { customerId: parseInt(userId) };
      if (args.status) {
        where.status = args.status;
      }

      const orders = await db.order.findMany({
        where,
        take: args.limit ?? 20,
        skip: args.offset ?? 0,
        include: { product: true },
        orderBy: { orderDate: 'desc' },
      });

      return {
        success: true,
        data: {
          orders,
          count: orders.length,
          hasMore: orders.length === (args.limit ?? 20),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  // Product queries
  getProduct: async (_: unknown, args: { productId: number }) => {
    try {
      const product = await db.product.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return { success: false, product: null, error: 'Product not found' };
      }

      return { success: true, product, error: null };
    } catch (error) {
      return { success: false, product: null, error: (error as Error).message };
    }
  },

  searchProducts: async (
    _: unknown,
    args: {
      query: string;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
      limit?: number;
    }
  ) => {
    try {
      const where: Record<string, unknown> = {
        OR: [
          { name: { contains: args.query, mode: 'insensitive' } },
          { description: { contains: args.query, mode: 'insensitive' } },
        ],
      };

      if (args.category) where.category = args.category;

      if (args.minPrice !== undefined || args.maxPrice !== undefined) {
        where.price = {};
        if (args.minPrice !== undefined) (where.price as Record<string, number>).gte = args.minPrice;
        if (args.maxPrice !== undefined) (where.price as Record<string, number>).lte = args.maxPrice;
      }

      if (args.inStock !== undefined) {
        where.stock = args.inStock ? { gt: 0 } : { equals: 0 };
      }

      const products = await db.product.findMany({ where, take: args.limit ?? 10 });

      return {
        success: true,
        data: { products, query: args.query, count: products.length },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  // Refund queries
  getRefundStatus: async (
    _: unknown,
    args: { refundId: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, refund: null, error: 'Authorization required' };
    }

    try {
      const refund = await db.refund.findUnique({
        where: { id: args.refundId },
      });

      if (!refund) {
        return { success: false, refund: null, error: 'Refund not found' };
      }

      return { success: true, refund, error: null };
    } catch (error) {
      return { success: false, refund: null, error: (error as Error).message };
    }
  },

  // Support ticket queries
  getTicketStatus: async (
    _: unknown,
    args: { ticketId: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, ticket: null, error: 'Authorization required' };
    }

    try {
      const ticket = await db.supportTicket.findUnique({
        where: { id: args.ticketId },
      });

      if (!ticket) {
        return { success: false, ticket: null, error: 'Ticket not found' };
      }

      if (ticket.customerId !== parseInt(userId)) {
        return { success: false, ticket: null, error: 'Ticket not found' };
      }

      return { success: true, ticket, error: null };
    } catch (error) {
      return { success: false, ticket: null, error: (error as Error).message };
    }
  },

  // Cart queries
  getCart: async (
    _: unknown,
    args: { cartId?: string },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId || userId },
        include: { items: { include: { product: true } } },
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
          error: null,
        };
      }

      const items = cart.items.map((item) => ({
        productId: item.product.id.toString(),
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        success: true,
        data: {
          cartId: cart.id,
          items,
          subtotal,
          total: subtotal,
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },
});
