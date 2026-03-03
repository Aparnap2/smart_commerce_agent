/**
 * UCP (Universal Commerce Protocol) Type Definitions
 *
 * Protocol types for commerce transactions including offers, payments, and orders.
 */

/**
 * Payment status types
 */
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded';

/**
 * Order status types
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/**
 * UCP Offer - A price offer for a product
 */
export interface UCPOffer {
  /** Unique offer identifier */
  id: string;
  /** Product being offered */
  productId: string;
  /** Offer price in cents */
  price: number;
  /** Terms and conditions */
  terms: string;
  /** Offer expiration date */
  validUntil: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * UCP Payment - A payment transaction
 */
export interface UCPPayment {
  /** Unique payment identifier */
  id: string;
  /** Associated offer */
  offerId: string;
  /** Payment amount in cents */
  amount: number;
  /** Payment status */
  status: PaymentStatus;
  /** Payment method identifier */
  method?: string;
  /** Transaction ID from payment processor */
  transactionId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * UCP Order - A customer order
 */
export interface UCPOrder {
  /** Unique order identifier */
  id: string;
  /** Customer who placed the order */
  customerId: string;
  /** Associated offer */
  offerId: string;
  /** Associated payment */
  paymentId: string;
  /** Order status */
  status: OrderStatus;
  /** Order total in cents */
  total: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * UCP Customer - A customer profile
 */
export interface UCPCustomer {
  /** Unique customer identifier */
  id: string;
  /** Customer email */
  email: string;
  /** Customer name */
  name: string;
  /** Available payment methods */
  paymentMethods: string[];
  /** Default payment method */
  defaultPaymentMethod?: string;
}

/**
 * Create Direct Offer Request
 */
export interface CreateDirectOfferRequest {
  productId: string;
  price: number;
  terms: string;
  validDays?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create Payment Request
 */
export interface CreatePaymentRequest {
  offerId: string;
  customerId: string;
  amount: number;
  method?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create Order Request
 */
export interface CreateOrderRequest {
  customerId: string;
  offerId: string;
  paymentId: string;
  total: number;
}

/**
 * Payment Result
 */
export interface PaymentResult {
  success: boolean;
  payment?: UCPPayment;
  error?: string;
}

/**
 * Order Result
 */
export interface OrderResult {
  success: boolean;
  order?: UCPOrder;
  error?: string;
}

/**
 * Utility function to format price in dollars
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Utility function to parse price to cents
 */
export function parsePrice(dollars: string): number {
  return Math.round(parseFloat(dollars.replace('$', '')) * 100);
}
