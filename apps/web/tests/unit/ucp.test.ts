/**
 * UCP (Universal Commerce Protocol) Unit Tests
 *
 * Tests for the mock UCP protocol implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * UCP Types (matching protocol specification)
 */
interface UCPOffer {
  id: string;
  productId: string;
  price: number;
  terms: string;
  validUntil: Date;
  metadata?: Record<string, unknown>;
}

interface UCPPayment {
  id: string;
  offerId: string;
  amount: number;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
  method?: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

interface UCPOrder {
  id: string;
  customerId: string;
  offerId: string;
  paymentId: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UCPCustomer {
  id: string;
  email: string;
  name: string;
  paymentMethods: string[];
  defaultPaymentMethod?: string;
}

/**
 * Mock UCP Protocol Implementation
 */
class MockUCPProtocol {
  private offers: Map<string, UCPOffer> = new Map();
  private payments: Map<string, UCPPayment> = new Map();
  private orders: Map<string, UCPOrder> = new Map();
  private customers: Map<string, UCPCustomer> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock customers
    const customer: UCPCustomer = {
      id: 'cust-1',
      email: 'user@techtrend.com',
      name: 'Test User',
      paymentMethods: ['pm-1', 'pm-2'],
      defaultPaymentMethod: 'pm-1',
    };
    this.customers.set(customer.id, customer);

    // Mock offers
    const offers: UCPOffer[] = [
      {
        id: 'offer-1',
        productId: 'prod-laptop-1',
        price: 999.99,
        terms: 'Standard 30-day return policy',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      {
        id: 'offer-2',
        productId: 'prod-headphones-1',
        price: 149.99,
        terms: 'No returns on opened headphones',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
    ];

    offers.forEach((offer) => this.offers.set(offer.id, offer));
  }

  // Customer Methods
  getCustomer(id: string): UCPCustomer | undefined {
    return this.customers.get(id);
  }

  getCustomerByEmail(email: string): UCPCustomer | undefined {
    return Array.from(this.customers.values()).find((c) => c.email === email);
  }

  // Offer Methods
  getOffer(id: string): UCPOffer | undefined {
    return this.offers.get(id);
  }

  getActiveOffers(): UCPOffer[] {
    const now = Date.now();
    return Array.from(this.offers.values()).filter(
      (offer) => new Date(offer.validUntil).getTime() > now
    );
  }

  createDirectOffer(
    productId: string,
    price: number,
    terms: string,
    validDays: number = 7
  ): UCPOffer {
    const offer: UCPOffer = {
      id: `offer-${Date.now()}`,
      productId,
      price,
      terms,
      validUntil: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000),
    };
    this.offers.set(offer.id, offer);
    return offer;
  }

  // Payment Methods
  async createPayment(
    offerId: string,
    customerId: string,
    amount: number,
    method: string = 'default'
  ): Promise<UCPPayment> {
    const offer = this.offers.get(offerId);
    if (!offer) {
      throw new Error(`Offer not found: ${offerId}`);
    }

    const payment: UCPPayment = {
      id: `pay-${Date.now()}`,
      offerId,
      amount,
      status: 'pending',
      method,
      createdAt: new Date(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async authorizePayment(paymentId: string): Promise<UCPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // Simulate payment authorization (90% success rate)
    const isSuccessful = Math.random() < 0.9;

    payment.status = isSuccessful ? 'authorized' : 'failed';
    payment.transactionId = isSuccessful
      ? `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : undefined;

    if (isSuccessful) {
      payment.completedAt = new Date();
    }

    return payment;
  }

  async capturePayment(paymentId: string): Promise<UCPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== 'authorized') {
      throw new Error(`Payment not authorized: ${paymentId}`);
    }

    payment.status = 'captured';
    payment.completedAt = new Date();
    return payment;
  }

  async refundPayment(paymentId: string): Promise<UCPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (!['authorized', 'captured'].includes(payment.status)) {
      throw new Error(`Payment cannot be refunded: ${paymentId}`);
    }

    payment.status = 'refunded';
    payment.completedAt = new Date();
    return payment;
  }

  getPayment(id: string): UCPPayment | undefined {
    return this.payments.get(id);
  }

  // Order Methods
  async createOrder(
    customerId: string,
    offerId: string,
    paymentId: string,
    total: number
  ): Promise<UCPOrder> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const order: UCPOrder = {
      id: `ord-${Date.now()}`,
      customerId,
      offerId,
      paymentId,
      status: 'pending',
      total,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  confirmOrder(orderId: string): UCPOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    order.status = 'confirmed';
    order.updatedAt = new Date();
    return order;
  }

  shipOrder(orderId: string): UCPOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    order.status = 'shipped';
    order.updatedAt = new Date();
    return order;
  }

  deliverOrder(orderId: string): UCPOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    order.status = 'delivered';
    order.updatedAt = new Date();
    return order;
  }

  cancelOrder(orderId: string): UCPOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (['shipped', 'delivered'].includes(order.status)) {
      throw new Error(`Cannot cancel order: ${orderId}`);
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();
    return order;
  }

  getOrder(id: string): UCPOrder | undefined {
    return this.orders.get(id);
  }

  getCustomerOrders(customerId: string): UCPOrder[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerId === customerId
    );
  }
}

describe('UCP Protocol', () => {
  let ucp: MockUCPProtocol;

  beforeEach(() => {
    ucp = new MockUCPProtocol();
  });

  describe('Customer Management', () => {
    it('should get customer by ID', () => {
      const customer = ucp.getCustomer('cust-1');
      expect(customer).toBeDefined();
      expect(customer?.email).toBe('user@techtrend.com');
    });

    it('should get customer by email', () => {
      const customer = ucp.getCustomerByEmail('user@techtrend.com');
      expect(customer).toBeDefined();
      expect(customer?.id).toBe('cust-1');
    });

    it('should return undefined for unknown customer', () => {
      const customer = ucp.getCustomer('unknown');
      expect(customer).toBeUndefined();
    });
  });

  describe('Offer Management', () => {
    it('should get offer by ID', () => {
      const offer = ucp.getOffer('offer-1');
      expect(offer).toBeDefined();
      expect(offer?.productId).toBe('prod-laptop-1');
      expect(offer?.price).toBe(999.99);
    });

    it('should get active offers only', () => {
      const activeOffers = ucp.getActiveOffers();
      expect(activeOffers.length).toBeGreaterThan(0);
      activeOffers.forEach((offer) => {
        expect(new Date(offer.validUntil).getTime()).toBeGreaterThan(Date.now());
      });
    });

    it('should create direct offer', () => {
      const offer = ucp.createDirectOffer('prod-new-1', 299.99, 'Test terms', 30);
      expect(offer.id).toBeDefined();
      expect(offer.productId).toBe('prod-new-1');
      expect(offer.price).toBe(299.99);
      expect(offer.terms).toBe('Test terms');
    });
  });

  describe('Payment Flow', () => {
    it('should create payment', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      expect(payment.id).toBeDefined();
      expect(payment.offerId).toBe('offer-1');
      expect(payment.amount).toBe(999.99);
      expect(payment.status).toBe('pending');
    });

    it('should authorize payment', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      const authorized = await ucp.authorizePayment(payment.id);

      expect(['authorized', 'failed']).toContain(authorized.status);
      if (authorized.status === 'authorized') {
        expect(authorized.transactionId).toBeDefined();
        expect(authorized.completedAt).toBeDefined();
      }
    });

    it('should capture authorized payment', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      await ucp.authorizePayment(payment.id);
      const captured = await ucp.capturePayment(payment.id);

      expect(captured.status).toBe('captured');
    });

    it('should not capture unauthorized payment', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      // Don't authorize, try to capture directly

      await expect(ucp.capturePayment(payment.id)).rejects.toThrow(
        'Payment not authorized'
      );
    });

    it('should refund captured payment', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      let authResult = await ucp.authorizePayment(payment.id);
      // Retry if authorization failed (10% chance)
      if (authResult.status !== 'authorized') {
        authResult = await ucp.authorizePayment(payment.id);
      }
      await ucp.capturePayment(payment.id);
      const refunded = await ucp.refundPayment(payment.id);

      expect(refunded.status).toBe('refunded');
    });
  });

  describe('Order Management', () => {
    it('should create order', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      await ucp.authorizePayment(payment.id);

      const order = await ucp.createOrder('cust-1', 'offer-1', payment.id, 999.99);
      expect(order.id).toBeDefined();
      expect(order.customerId).toBe('cust-1');
      expect(order.status).toBe('pending');
      expect(order.total).toBe(999.99);
    });

    it('should transition order through states', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      await ucp.authorizePayment(payment.id);
      await ucp.capturePayment(payment.id);

      const order = await ucp.createOrder('cust-1', 'offer-1', payment.id, 999.99);

      const confirmed = ucp.confirmOrder(order.id);
      expect(confirmed.status).toBe('confirmed');

      const shipped = ucp.shipOrder(order.id);
      expect(shipped.status).toBe('shipped');

      const delivered = ucp.deliverOrder(order.id);
      expect(delivered.status).toBe('delivered');
    });

    it('should cancel pending order', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      let authResult = await ucp.authorizePayment(payment.id);
      // Retry if authorization failed (10% chance)
      if (authResult.status !== 'authorized') {
        authResult = await ucp.authorizePayment(payment.id);
      }
      await ucp.capturePayment(payment.id);

      const order = await ucp.createOrder('cust-1', 'offer-1', payment.id, 999.99);
      const cancelled = ucp.cancelOrder(order.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should not cancel shipped order', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      const authResult = await ucp.authorizePayment(payment.id);
      // Ensure payment is authorized (retry if needed due to random failure)
      if (authResult.status !== 'authorized') {
        const retry = await ucp.authorizePayment(payment.id);
        expect(retry.status).toBe('authorized');
      }
      await ucp.capturePayment(payment.id);

      const order = await ucp.createOrder('cust-1', 'offer-1', payment.id, 999.99);
      ucp.confirmOrder(order.id);
      ucp.shipOrder(order.id);

      expect(() => ucp.cancelOrder(order.id)).toThrow('Cannot cancel order');
    });

    it('should get customer orders', async () => {
      const payment = await ucp.createPayment('offer-1', 'cust-1', 999.99);
      let authResult = await ucp.authorizePayment(payment.id);
      // Retry if authorization failed (10% chance)
      if (authResult.status !== 'authorized') {
        authResult = await ucp.authorizePayment(payment.id);
      }
      await ucp.capturePayment(payment.id);

      await ucp.createOrder('cust-1', 'offer-1', payment.id, 999.99);

      const orders = ucp.getCustomerOrders('cust-1');
      expect(orders.length).toBeGreaterThan(0);
      orders.forEach((order) => {
        expect(order.customerId).toBe('cust-1');
      });
    });
  });

  describe('Complete Commerce Flow', () => {
    it('should execute complete purchase flow', async () => {
      // 1. Customer views offer
      const offer = ucp.getOffer('offer-1');
      expect(offer).toBeDefined();

      // 2. Customer creates payment
      const payment = await ucp.createPayment(offer!.id, 'cust-1', offer!.price);
      expect(payment.status).toBe('pending');

      // 3. Payment is authorized (with retry)
      let authorized = await ucp.authorizePayment(payment.id);
      if (authorized.status !== 'authorized') {
        authorized = await ucp.authorizePayment(payment.id);
      }
      expect(authorized.status).toBe('authorized');

      // 4. Payment is captured
      const captured = await ucp.capturePayment(payment.id);
      expect(captured.status).toBe('captured');

      // 5. Order is created and confirmed
      const order = await ucp.createOrder('cust-1', offer!.id, captured.id, offer!.price);
      expect(order.status).toBe('pending');

      const confirmed = ucp.confirmOrder(order.id);
      expect(confirmed.status).toBe('confirmed');

      const shipped = ucp.shipOrder(order.id);
      expect(shipped.status).toBe('shipped');

      const delivered = ucp.deliverOrder(order.id);
      expect(delivered.status).toBe('delivered');
    });
  });
});
