import { PrismaClient } from '@prisma/client';

export const mutationResolvers = (db: PrismaClient) => ({
  // Refund mutations
  createRefund: async (
    _: unknown,
    args: {
      orderId: number;
      reason: string;
      reasonDescription?: string;
      amount?: number;
    },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, refund: null, error: 'Authorization required' };
    }

    try {
      const order = await db.order.findUnique({
        where: { id: args.orderId },
      });

      if (!order || order.customerId !== parseInt(userId)) {
        return { success: false, refund: null, error: 'Order not found' };
      }

      const refund = await db.refund.create({
        data: {
          stripeRefundId: `refund_${Date.now()}`,
          paymentIntentId: `pi_${Date.now()}`,
          orderId: args.orderId,
          customerEmail: '',
          amount: args.amount ?? Math.floor(order.total * 100),
          currency: 'usd',
          status: 'pending',
          reason: args.reason,
        },
      });

      return { success: true, refund, error: null };
    } catch (error) {
      return { success: false, refund: null, error: (error as Error).message };
    }
  },

  // Support ticket mutations
  createSupportTicket: async (
    _: unknown,
    args: {
      orderId?: number;
      subject: string;
      description: string;
      category: string;
      priority?: string;
    },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, ticket: null, error: 'Authorization required' };
    }

    try {
      const ticket = await db.supportTicket.create({
        data: {
          customerId: parseInt(userId),
          relatedOrderId: args.orderId || null,
          issue: `${args.subject}: ${args.description}`,
          status: 'open',
          priority: args.priority ?? 'medium',
        },
      });

      return { success: true, ticket, error: null };
    } catch (error) {
      return { success: false, ticket: null, error: (error as Error).message };
    }
  },

  addTicketMessage: async (
    _: unknown,
    args: {
      ticketId: number;
      message: string;
      isInternal?: boolean;
    },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const ticket = await db.supportTicket.findUnique({
        where: { id: args.ticketId },
      });

      if (!ticket || ticket.customerId !== parseInt(userId)) {
        return { success: false, data: null, error: 'Ticket not found' };
      }

      return {
        success: true,
        data: {
          ticketId: args.ticketId.toString(),
          message: args.message,
          timestamp: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  // Cart mutations
  addToCart: async (
    _: unknown,
    args: { productId: string; quantity?: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const product = await db.product.findUnique({
        where: { id: parseInt(args.productId) },
      });

      if (!product) {
        return { success: false, data: null, error: 'Product not found' };
      }

      let cart = await db.cart.findUnique({
        where: { id: userId },
      });

      if (!cart) {
        cart = await db.cart.create({
          data: { id: userId, customerId: userId },
        });
      }

      await db.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: parseInt(args.productId),
          },
        },
        update: {
          quantity: { increment: args.quantity ?? 1 },
        },
        create: {
          cartId: cart.id,
          productId: parseInt(args.productId),
          quantity: args.quantity ?? 1,
          price: product.price,
        },
      });

      return {
        success: true,
        data: {
          cartId: cart.id,
          productId: args.productId,
          quantity: args.quantity ?? 1,
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  updateCartQuantity: async (
    _: unknown,
    args: { cartId: string; productId: number; quantity: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    if (args.quantity <= 0) {
      return { success: false, data: null, error: 'Quantity must be positive' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      const product = await db.product.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return { success: false, data: null, error: 'Product not found' };
      }

      const result = await db.cartItem.update({
        where: {
          cartId_productId: {
            cartId: args.cartId,
            productId: args.productId,
          },
        },
        data: { quantity: args.quantity },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          productId: args.productId,
          quantity: args.quantity,
          updatedAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  removeCartItem: async (
    _: unknown,
    args: { cartId: string; productId: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      const result = await db.cartItem.delete({
        where: {
          cartId_productId: {
            cartId: args.cartId,
            productId: args.productId,
          },
        },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          productId: args.productId,
          removed: true,
          updatedAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  clearCart: async (
    _: unknown,
    args: { cartId: string },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
        include: { items: true },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      const itemCount = cart.items.length;

      await db.cartItem.deleteMany({
        where: { cartId: args.cartId },
      });

      const updatedCart = await db.cart.update({
        where: { id: args.cartId },
        data: { couponCode: null },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          clearedItems: itemCount,
          updatedAt: updatedCart.updatedAt,
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  applyCoupon: async (
    _: unknown,
    args: { cartId: string; couponCode: string },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      const coupon = await db.coupon.findUnique({
        where: { code: args.couponCode },
      });

      if (!coupon) {
        return { success: false, data: null, error: 'Invalid coupon code' };
      }

      if (!coupon.isActive) {
        return { success: false, data: null, error: 'Coupon is not active' };
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return { success: false, data: null, error: 'Coupon has expired' };
      }

      const cartTotal = cart.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      let discount = 0;
      if (coupon.discountType === 'percentage') {
        discount = cartTotal * (coupon.discountValue / 100);
      } else if (coupon.discountType === 'fixed') {
        discount = coupon.discountValue;
      }

      const result = await db.cart.update({
        where: { id: args.cartId },
        data: { couponCode: args.couponCode },
      });

      return {
        success: true,
        data: {
          cartId: args.cartId,
          couponCode: args.couponCode,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discount,
          newTotal: cartTotal - discount,
          updatedAt: result.updatedAt,
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  // Checkout mutations
  createCheckout: async (
    _: unknown,
    args: {
      cartId: string;
      paymentMethodId: string;
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
      };
    },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      if (!cart.items || cart.items.length === 0) {
        return { success: false, data: null, error: 'Cart is empty' };
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      let discount = 0;
      if (cart.couponCode) {
        const coupon = await db.coupon.findUnique({
          where: { code: cart.couponCode },
        });
        if (coupon) {
          if (coupon.discountType === 'percentage') {
            discount = subtotal * (coupon.discountValue / 100);
          } else if (coupon.discountType === 'fixed') {
            discount = coupon.discountValue;
          }
        }
      }

      const total = subtotal - discount;
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
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  // Order mutations
  createOrderFromCart: async (
    _: unknown,
    args: { cartId: string },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const cart = await db.cart.findUnique({
        where: { id: args.cartId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.customerId !== userId) {
        return { success: false, data: null, error: 'Cart not found' };
      }

      if (!cart.items || cart.items.length === 0) {
        return { success: false, data: null, error: 'Cart is empty' };
      }

      // Create an order for each item in cart (simplified)
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

      await db.cartItem.deleteMany({
        where: { cartId: args.cartId },
      });

      await db.cart.update({
        where: { id: args.cartId },
        data: { couponCode: null },
      });

      return {
        success: true,
        data: {
          orderId: order.id.toString(),
          cartId: args.cartId,
          status: 'confirmed',
          itemCount: cart.items.length,
          createdAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },

  cancelOrder: async (
    _: unknown,
    args: { orderId: number },
    context: { userId: string | null }
  ) => {
    const { userId } = context;
    if (!userId) {
      return { success: false, data: null, error: 'Authorization required' };
    }

    try {
      const order = await db.order.findUnique({
        where: { id: args.orderId },
      });

      if (!order || order.customerId !== parseInt(userId)) {
        return { success: false, data: null, error: 'Order not found' };
      }

      if (order.status === 'shipped' || order.status === 'delivered') {
        return {
          success: false,
          data: null,
          error: `Cannot cancel order that has been ${order.status}`,
        };
      }

      const result = await db.order.update({
        where: { id: args.orderId },
        data: { status: 'cancelled' },
      });

      return {
        success: true,
        data: {
          orderId: args.orderId.toString(),
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  },
});
