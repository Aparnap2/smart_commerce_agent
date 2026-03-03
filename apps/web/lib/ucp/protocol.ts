/**
 * UCP (Universal Commerce Protocol) Mock Implementation
 *
 * Mock implementation of the commerce protocol for testing and demo purposes.
 */

import {
  UCPOffer,
  UCPPayment,
  UCPOrder,
  UCPCustomer,
  PaymentResult,
  OrderResult,
  CreateDirectOfferRequest,
  CreatePaymentRequest,
  CreateOrderRequest,
} from './types.js';

/**
 * Mock UCP Protocol Implementation
 */
export class UCPProtocol {
  private offers: Map<string, UCPOffer> = new Map();
  private payments: Map<string, UCPPayment> = new Map();
  private orders: Map<string, UCPOrder> = new Map();
  private customers: Map<string, UCPCustomer> = new Map();

  constructor() {
    this.initializeMockData();
  }

  /**
   * Initialize with mock data for testing
   */
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
        price: 99999,
        terms: 'Standard 30-day return policy',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'offer-2',
        productId: 'prod-headphones-1',
        price: 14999,
        terms: 'No returns on opened headphones',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ];

    offers.forEach((offer) => this.offers.set(offer.id, offer));
  }

  // ==================== Customer Methods ====================

  /**
   * Get customer by ID
   */
  getCustomer(id: string): UCPCustomer | undefined {
    return this.customers.get(id);
  }

  /**
   * Get customer by email
   */
  getCustomerByEmail(email: string): UCPCustomer | undefined {
    return Array.from(this.customers.values()).find((c) => c.email === email);
  }

  /**
   * Get all customers
   */
  getAllCustomers(): UCPCustomer[] {
    return Array.from(this.customers.values());
  }

  // ==================== Offer Methods ====================

  /**
   * Get offer by ID
   */
  getOffer(id: string): UCPOffer | undefined {
    return this.offers.get(id);
  }

  /**
   * Get all active (non-expired) offers
   */
  getActiveOffers(): UCPOffer[] {
    const now = Date.now();
    return Array.from(this.offers.values()).filter(
      (offer) => new Date(offer.validUntil).getTime() > now
    );
  }

  /**
   * Get all offers
   */
  getAllOffers(): UCPOffer[] {
    return Array.from(this.offers.values());
  }

  /**
   * Create a direct offer for a product
   */
  createDirectOffer(request: CreateDirectOfferRequest): UCPOffer {
    const offer: UCPOffer = {
      id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId: request.productId,
      price: request.price,
      terms: request.terms,
      validUntil: new Date(
        Date.now() + (request.validDays || 7) * 24 * 60 * 60 * 1000
      ),
      metadata: request.metadata,
    };
    this.offers.set(offer.id, offer);
    return offer;
  }

  // ==================== Payment Methods ====================

  /**
   * Create a new payment
   */
  async createPayment(request: CreatePaymentRequest): Promise<UCPPayment> {
    const offer = this.offers.get(request.offerId);
    if (!offer) {
      throw new Error(`Offer not found: ${request.offerId}`);
    }

    const payment: UCPPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      offerId: request.offerId,
      amount: request.amount,
      status: 'pending',
      method: request.method,
      createdAt: new Date(),
      metadata: request.metadata,
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  /**
   * Authorize a payment (simulated)
   */
  async authorizePayment(paymentId: string): Promise<PaymentResult> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { success: false, error: `Payment not found: ${paymentId}` };
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

    return {
      success: isSuccessful,
      payment,
      error: isSuccessful ? undefined : 'Payment authorization failed',
    };
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(paymentId: string): Promise<PaymentResult> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { success: false, error: `Payment not found: ${paymentId}` };
    }

    if (payment.status !== 'authorized') {
      return {
        success: false,
        error: `Payment not authorized: ${paymentId}`,
      };
    }

    payment.status = 'captured';
    payment.completedAt = new Date();

    return { success: true, payment };
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string): Promise<PaymentResult> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { success: false, error: `Payment not found: ${paymentId}` };
    }

    if (!['authorized', 'captured'].includes(payment.status)) {
      return {
        success: false,
        error: `Payment cannot be refunded: ${paymentId}`,
      };
    }

    payment.status = 'refunded';
    payment.completedAt = new Date();

    return { success: true, payment };
  }

  /**
   * Get payment by ID
   */
  getPayment(id: string): UCPPayment | undefined {
    return this.payments.get(id);
  }

  // ==================== Order Methods ====================

  /**
   * Create a new order
   */
  async createOrder(request: CreateOrderRequest): Promise<OrderResult> {
    const customer = this.customers.get(request.customerId);
    if (!customer) {
      return { success: false, error: `Customer not found: ${request.customerId}` };
    }

    const payment = this.payments.get(request.paymentId);
    if (!payment) {
      return { success: false, error: `Payment not found: ${request.paymentId}` };
    }

    if (payment.status !== 'captured') {
      return {
        success: false,
        error: 'Payment must be captured before creating order',
      };
    }

    const order: UCPOrder = {
      id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      customerId: request.customerId,
      offerId: request.offerId,
      paymentId: request.paymentId,
      status: 'pending',
      total: request.total,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(order.id, order);

    return { success: true, order };
  }

  /**
   * Confirm an order
   */
  confirmOrder(orderId: string): OrderResult {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: `Order not found: ${orderId}` };
    }

    order.status = 'confirmed';
    order.updatedAt = new Date();

    return { success: true, order };
  }

  /**
   * Ship an order
   */
  shipOrder(orderId: string): OrderResult {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: `Order not found: ${orderId}` };
    }

    order.status = 'shipped';
    order.updatedAt = new Date();

    return { success: true, order };
  }

  /**
   * Mark an order as delivered
   */
  deliverOrder(orderId: string): OrderResult {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: `Order not found: ${orderId}` };
    }

    order.status = 'delivered';
    order.updatedAt = new Date();

    return { success: true, order };
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): OrderResult {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: `Order not found: ${orderId}` };
    }

    if (['shipped', 'delivered'].includes(order.status)) {
      return {
        success: false,
        error: `Cannot cancel order: ${orderId}`,
      };
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();

    return { success: true, order };
  }

  /**
   * Get order by ID
   */
  getOrder(id: string): UCPOrder | undefined {
    return this.orders.get(id);
  }

  /**
   * Get all orders for a customer
   */
  getCustomerOrders(customerId: string): UCPOrder[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerId === customerId
    );
  }

  /**
   * Get all orders
   */
  getAllOrders(): UCPOrder[] {
    return Array.from(this.orders.values());
  }

  // ==================== Commerce Flow Methods ====================

  /**
   * Execute a complete purchase flow
   * Creates offer, payment, authorizes it, captures it, and creates order
   */
  async executePurchaseFlow(
    customerId: string,
    productId: string,
    price: number,
    terms: string = 'Standard terms'
  ): Promise<{
    offer: UCPOffer;
    payment: UCPPayment;
    order: UCPOrder;
  }> {
    // Create offer
    const offer = this.createDirectOffer({
      productId,
      price,
      terms,
    });

    // Create and authorize payment
    const payment = await this.createPayment({
      offerId: offer.id,
      customerId,
      amount: price,
    });

    const authResult = await this.authorizePayment(payment.id);
    if (!authResult.success || !authResult.payment) {
      throw new Error('Payment authorization failed');
    }

    const captureResult = await this.capturePayment(authResult.payment.id);
    if (!captureResult.success || !captureResult.payment) {
      throw new Error('Payment capture failed');
    }

    // Create order
    const orderResult = await this.createOrder({
      customerId,
      offerId: offer.id,
      paymentId: captureResult.payment.id,
      total: price,
    });

    if (!orderResult.success || !orderResult.order) {
      throw new Error('Order creation failed');
    }

    // Confirm order
    this.confirmOrder(orderResult.order.id);

    return {
      offer,
      payment: captureResult.payment,
      order: orderResult.order,
    };
  }
}

// Export singleton instance for convenience
export const ucpProtocol = new UCPProtocol();
