/**
 * Schema Mapper
 *
 * Maps database models to Schema.org compliant JSON-LD structures.
 * Provides bidirectional mapping between internal data models and
 * Schema.org commerce schemas.
 *
 * @packageDocumentation
 */

import type {
  Product,
  Order,
  OrderItem,
  Refund,
  SupportTicket,
  ShoppingCart,
  CartItem,
} from './commerce';
import {
  ProductSchema,
  OrderSchema,
  RefundSchema,
  SupportTicketSchema,
  ShoppingCartSchema,
  OfferSchema,
  OrderItemSchema,
} from './commerce';

// ============================================================================
// Internal Database Types (Prisma-compatible)
// ============================================================================

/**
 * Internal product model (matches Prisma schema)
 */
export interface InternalProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  currency: string;
  inventory: number;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER' | 'BACK_ORDER';
  category: string | null;
  tags: string[];
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  rating: number | null;
  reviewCount: number | null;
  gtin: string | null;
  mpn: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Internal order model
 */
export interface InternalOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerName: string | null;
  status: 'CANCELLED' | 'DELIVERED' | 'IN_TRANSIT' | 'PAYMENT_DUE' | 'PICKUP_AVAILABLE' | 'PROBLEM' | 'PROCESSING' | 'RETURNED';
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  trackingNumber: string | null;
  carrier: string | null;
  orderDate: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  notes: string | null;
  items: InternalOrderItem[];
}

/**
 * Internal order item model
 */
export interface InternalOrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Internal refund model
 */
export interface InternalRefund {
  id: string;
  refundId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  reason: 'DEFECTIVE' | 'NOT_AS_DESCRIBED' | 'WRONG_ITEM' | 'CHANGED_MIND' | 'DUPLICATE_ORDER' | 'OTHER';
  reasonDescription: string | null;
  refundMethod: 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'EXCHANGE';
  processingFee: number | null;
  returnShippingRequired: boolean;
  returnShippingLabel: string | null;
  returnTrackingNumber: string | null;
  dateRequested: Date;
  dateProcessed: Date | null;
  dateCompleted: Date | null;
  notes: string | null;
}

/**
 * Internal support ticket model
 */
export interface InternalSupportTicket {
  id: string;
  ticketId: string;
  orderId: string | null;
  orderNumber: string | null;
  customerId: string;
  customerEmail: string;
  customerName: string | null;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'PENDING_MERCHANT' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'ORDER_STATUS' | 'SHIPPING' | 'RETURN' | 'REFUND' | 'PRODUCT_INFO' | 'PAYMENT' | 'ACCOUNT' | 'TECHNICAL' | 'OTHER';
  channel: 'WEB' | 'EMAIL' | 'PHONE' | 'CHAT' | 'SOCIAL' | 'API';
  assignedTo: string | null;
  assignedToEmail: string | null;
  resolutionType: 'REFUND' | 'REPLACEMENT' | 'FIX' | 'CREDIT' | 'OTHER' | null;
  resolutionAmount: number | null;
  resolutionDescription: string | null;
  dateCreated: Date;
  dateUpdated: Date | null;
  dateResolved: Date | null;
  messages: InternalTicketMessage[];
  tags: string[];
}

/**
 * Internal ticket message model
 */
export interface InternalTicketMessage {
  id: string;
  authorName: string;
  authorType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  text: string;
  isInternal: boolean;
  createdAt: Date;
}

/**
 * Internal cart model
 */
export interface InternalCart {
  id: string;
  cartId: string;
  customerId: string;
  items: InternalCartItem[];
  subtotal: number;
  discount: number;
  shippingEstimate: number | null;
  taxEstimate: number | null;
  total: number;
  currency: string;
  couponCode: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Internal cart item model
 */
export interface InternalCartItem {
  productId: string;
  productSku: string;
  productName: string;
  productImageUrl: string | null;
  productPrice: number;
  quantity: number;
  addedAt: Date;
}

// ============================================================================
// Mapping Functions: Internal → Schema.org
// ============================================================================

/**
 * Maps internal product to Schema.org Product
 */
export function mapProductToSchema(product: InternalProduct): Product {
  const offers = OfferSchema.parse({
    price: product.price,
    priceCurrency: product.currency,
    availability: mapAvailability(product.availability),
    itemCondition: mapItemCondition(product),
    sku: product.sku,
    priceValidUntil: product.updatedAt.toISOString(),
  });

  const aggregateRating = product.rating !== null
    ? {
        '@type': 'AggregateRating' as const,
        ratingValue: product.rating,
        reviewCount: product.reviewCount ?? 0,
        bestRating: 5,
        worstRating: 1,
      }
    : undefined;

  return ProductSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'Product',
    sku: product.sku,
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrl ?? undefined,
    brand: product.brand
      ? {
          '@type': 'Brand' as const,
          name: product.brand,
        }
      : undefined,
    offers,
    category: product.category ? [product.category] : undefined,
    keywords: product.tags.length > 0 ? product.tags : undefined,
    weight: product.weight
      ? {
          '@type': 'QuantitativeValue' as const,
          value: product.weight,
          unitCode: 'kg',
        }
      : undefined,
    dimensions:
      product.length || product.width || product.height
        ? {
            '@type': 'QuantitativeValue' as const,
            length: product.length ?? undefined,
            width: product.width ?? undefined,
            height: product.height ?? undefined,
            unitCode: 'cm',
          }
        : undefined,
    aggregateRating,
    gtin: product.gtin ?? undefined,
    mpn: product.mpn ?? undefined,
  });
}

/**
 * Maps internal order item to Schema.org OrderItem
 */
export function mapOrderItemToSchema(item: InternalOrderItem): OrderItem {
  return OrderItemSchema.parse({
    '@type': 'OrderItem',
    orderItemId: item.id,
    product: ProductSchema.parse({
      '@type': 'Product',
      sku: item.productSku,
      name: item.productName,
      image: item.productImageUrl ?? undefined,
    }),
    quantity: item.quantity,
    unitPrice: {
      '@type': 'MonetaryAmount',
      value: item.unitPrice,
      currency: 'USD',
    },
    totalPrice: {
      '@type': 'MonetaryAmount',
      value: item.totalPrice,
      currency: 'USD',
    },
  });
}

/**
 * Maps internal order to Schema.org Order
 */
export function mapOrderToSchema(order: InternalOrder): Order {
  return OrderSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'Order',
    orderNumber: order.orderNumber,
    orderStatus: mapOrderStatus(order.status),
    customer: {
      '@type': 'Person',
      email: order.customerEmail,
      name: order.customerName ?? undefined,
    },
    orderedItem: order.items.map(mapOrderItemToSchema),
    billingAddress: order.billingAddress
      ? mapAddressToSchema(order.billingAddress)
      : undefined,
    shippingAddress: order.shippingAddress
      ? mapAddressToSchema(order.shippingAddress)
      : undefined,
    paymentMethod: order.paymentMethod
      ? {
          '@type': 'PaymentMethod',
          name: order.paymentMethod,
        }
      : undefined,
    paymentStatus: order.paymentStatus
      ? {
          '@type': 'PaymentStatus',
          name: order.paymentStatus,
        }
      : undefined,
    totalPrice: {
      '@type': 'MonetaryAmount',
      value: order.total,
      currency: order.currency,
    },
    discount:
      order.discount > 0
        ? {
            '@type': 'MonetaryAmount',
            value: order.discount,
            currency: order.currency,
          }
        : undefined,
    parcelDelivery:
      order.trackingNumber
        ? {
            '@type': 'ParcelDelivery',
            trackingNumber: order.trackingNumber,
            carrier: order.carrier ?? undefined,
            estimatedDeliveryDate: order.shippedAt?.toISOString() ?? undefined,
          }
        : undefined,
    orderDate: order.orderDate.toISOString(),
    // Note: URL omitted - can be added by caller with proper base URL
    // url: `/orders/${order.orderNumber}`,
    note: order.notes ?? undefined,
  });
}

/**
 * Maps internal refund to Schema.org Refund
 */
export function mapRefundToSchema(refund: InternalRefund): Refund {
  return RefundSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'Refund',
    refundId: refund.refundId,
    orderNumber: refund.orderNumber,
    customerId: refund.customerId,
    amount: {
      '@type': 'MonetaryAmount',
      value: refund.amount,
      currency: refund.currency,
    },
    status: mapRefundStatus(refund.status),
    reason: mapRefundReason(refund.reason),
    reasonDescription: refund.reasonDescription ?? undefined,
    refundMethod: mapRefundMethod(refund.refundMethod),
    processingFee:
      refund.processingFee !== null
        ? {
            '@type': 'MonetaryAmount',
            value: refund.processingFee,
            currency: refund.currency,
          }
        : undefined,
    returnShippingRequired: refund.returnShippingRequired,
    returnShippingLabel: refund.returnShippingLabel ?? undefined,
    returnTrackingNumber: refund.returnTrackingNumber ?? undefined,
    dateRequested: refund.dateRequested.toISOString(),
    dateProcessed: refund.dateProcessed?.toISOString() ?? undefined,
    dateCompleted: refund.dateCompleted?.toISOString() ?? undefined,
    notes: refund.notes ?? undefined,
  });
}

/**
 * Maps internal support ticket to Schema.org SupportTicket
 */
export function mapSupportTicketToSchema(ticket: InternalSupportTicket): SupportTicket {
  return SupportTicketSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'SupportTicket',
    ticketId: ticket.ticketId,
    orderNumber: ticket.orderNumber ?? undefined,
    customerId: ticket.customerId,
    subject: ticket.subject,
    description: ticket.description,
    status: mapTicketStatus(ticket.status),
    priority: mapTicketPriority(ticket.priority),
    category: mapTicketCategory(ticket.category),
    channel: mapTicketChannel(ticket.channel),
    assignedTo:
      ticket.assignedTo
        ? {
            '@type': 'Person',
            name: ticket.assignedTo,
            email: ticket.assignedToEmail ?? undefined,
          }
        : undefined,
    customer: {
      '@type': 'Person',
      email: ticket.customerEmail,
      name: ticket.customerName ?? undefined,
    },
    dateCreated: ticket.dateCreated.toISOString(),
    dateUpdated: ticket.dateUpdated?.toISOString() ?? undefined,
    dateResolved: ticket.dateResolved?.toISOString() ?? undefined,
    message: ticket.messages.map((msg) => ({
      '@type': 'Comment',
      author:
        msg.authorType === 'CUSTOMER'
          ? { '@type': 'Person', name: ticket.customerName || 'Customer' }
          : { '@type': 'Person', name: msg.authorName },
      datePublished: msg.createdAt.toISOString(),
      text: msg.text,
      isInternal: msg.isInternal,
    })),
    resolution:
      ticket.resolutionType
        ? {
            '@type': 'TicketResolution',
            resolutionType: mapResolutionType(ticket.resolutionType),
            amount:
              ticket.resolutionAmount !== null
                ? {
                    '@type': 'MonetaryAmount',
                    value: ticket.resolutionAmount,
                    currency: 'USD',
                  }
                : undefined,
            description: ticket.resolutionDescription ?? undefined,
            dateResolved: ticket.dateResolved?.toISOString() ?? undefined,
          }
        : undefined,
    tags: ticket.tags,
    // Note: URL omitted - can be added by caller with proper base URL
    // url: `/support/tickets/${ticket.ticketId}`,
  });
}

/**
 * Maps internal cart to Schema.org ShoppingCart
 */
export function mapShoppingCartToSchema(cart: InternalCart): ShoppingCart {
  const items: CartItem[] = cart.items.map((item) => ({
    '@type': 'CartItem',
    product: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      sku: item.productSku,
      name: item.productName,
      image: item.productImageUrl ?? undefined,
    },
    quantity: item.quantity,
    addedAt: item.addedAt.toISOString(),
    unitPrice: item.productPrice,
    totalPrice: item.productPrice * item.quantity,
  }));

  return ShoppingCartSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'ShoppingCart',
    cartId: cart.cartId,
    customerId: cart.customerId,
    item: items,
    subtotal: cart.subtotal,
    discount: cart.discount,
    shippingEstimate: cart.shippingEstimate ?? undefined,
    taxEstimate: cart.taxEstimate ?? undefined,
    total: cart.total,
    currency: cart.currency,
    dateCreated: cart.createdAt.toISOString(),
    dateUpdated: cart.updatedAt?.toISOString() ?? undefined,
    couponCode: cart.couponCode ? [cart.couponCode] : undefined,
    expiresAt: cart.expiresAt?.toISOString() ?? undefined,
  });
}

// ============================================================================
// Mapping Helpers
// ============================================================================

function mapAvailability(
  availability: InternalProduct['availability']
): 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' | 'https://schema.org/PreOrder' | 'https://schema.org/BackOrder' | 'https://schema.org/Discontinued' | undefined {
  const map: Record<InternalProduct['availability'], 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' | 'https://schema.org/PreOrder' | 'https://schema.org/BackOrder' | 'https://schema.org/Discontinued'> = {
    IN_STOCK: 'https://schema.org/InStock',
    OUT_OF_STOCK: 'https://schema.org/OutOfStock',
    PRE_ORDER: 'https://schema.org/PreOrder',
    BACK_ORDER: 'https://schema.org/BackOrder',
  };
  return map[availability] ?? 'https://schema.org/OutOfStock';
}

function mapItemCondition(
  product: InternalProduct
): 'https://schema.org/NewCondition' | 'https://schema.org/UsedCondition' | 'https://schema.org/RefurbishedCondition' | undefined {
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    return 'https://schema.org/RefurbishedCondition';
  }
  return undefined;
}

function mapOrderStatus(
  status: InternalOrder['status']
): 'https://schema.org/OrderCancelled' | 'https://schema.org/OrderDelivered' | 'https://schema.org/OrderInTransit' | 'https://schema.org/OrderPaymentDue' | 'https://schema.org/OrderPickupAvailable' | 'https://schema.org/OrderProblem' | 'https://schema.org/OrderProcessing' | 'https://schema.org/OrderReturned' {
  const map: Record<InternalOrder['status'], 'https://schema.org/OrderCancelled' | 'https://schema.org/OrderDelivered' | 'https://schema.org/OrderInTransit' | 'https://schema.org/OrderPaymentDue' | 'https://schema.org/OrderPickupAvailable' | 'https://schema.org/OrderProblem' | 'https://schema.org/OrderProcessing' | 'https://schema.org/OrderReturned'> = {
    CANCELLED: 'https://schema.org/OrderCancelled',
    DELIVERED: 'https://schema.org/OrderDelivered',
    IN_TRANSIT: 'https://schema.org/OrderInTransit',
    PAYMENT_DUE: 'https://schema.org/OrderPaymentDue',
    PICKUP_AVAILABLE: 'https://schema.org/OrderPickupAvailable',
    PROBLEM: 'https://schema.org/OrderProblem',
    PROCESSING: 'https://schema.org/OrderProcessing',
    RETURNED: 'https://schema.org/OrderReturned',
  };
  return map[status];
}

function mapRefundStatus(
  status: InternalRefund['status']
): 'pending' | 'approved' | 'denied' | 'processing' | 'completed' | 'cancelled' {
  const map: Record<InternalRefund['status'], 'pending' | 'approved' | 'denied' | 'processing' | 'completed' | 'cancelled'> = {
    PENDING: 'pending',
    APPROVED: 'approved',
    DENIED: 'denied',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };
  return map[status];
}

function mapRefundReason(
  reason: InternalRefund['reason']
): 'defective' | 'not_as_described' | 'wrong_item' | 'changed_mind' | 'duplicate_order' | 'other' {
  const map: Record<InternalRefund['reason'], 'defective' | 'not_as_described' | 'wrong_item' | 'changed_mind' | 'duplicate_order' | 'other'> = {
    DEFECTIVE: 'defective',
    NOT_AS_DESCRIBED: 'not_as_described',
    WRONG_ITEM: 'wrong_item',
    CHANGED_MIND: 'changed_mind',
    DUPLICATE_ORDER: 'duplicate_order',
    OTHER: 'other',
  };
  return map[reason];
}

function mapRefundMethod(
  method: InternalRefund['refundMethod']
): 'original_payment' | 'store_credit' | 'exchange' {
  const map: Record<InternalRefund['refundMethod'], 'original_payment' | 'store_credit' | 'exchange'> = {
    ORIGINAL_PAYMENT: 'original_payment',
    STORE_CREDIT: 'store_credit',
    EXCHANGE: 'exchange',
  };
  return map[method];
}

function mapTicketStatus(
  status: InternalSupportTicket['status']
): 'open' | 'in_progress' | 'pending_customer' | 'pending_merchant' | 'resolved' | 'closed' {
  const map: Record<InternalSupportTicket['status'], 'open' | 'in_progress' | 'pending_customer' | 'pending_merchant' | 'resolved' | 'closed'> = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    PENDING_CUSTOMER: 'pending_customer',
    PENDING_MERCHANT: 'pending_merchant',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
  };
  return map[status];
}

function mapTicketPriority(
  priority: InternalSupportTicket['priority']
): 'low' | 'medium' | 'high' | 'urgent' {
  const map: Record<InternalSupportTicket['priority'], 'low' | 'medium' | 'high' | 'urgent'> = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
  };
  return map[priority];
}

function mapTicketCategory(
  category: InternalSupportTicket['category']
): 'order_status' | 'shipping' | 'return' | 'refund' | 'product_info' | 'payment' | 'account' | 'technical' | 'other' {
  const map: Record<InternalSupportTicket['category'], 'order_status' | 'shipping' | 'return' | 'refund' | 'product_info' | 'payment' | 'account' | 'technical' | 'other'> = {
    ORDER_STATUS: 'order_status',
    SHIPPING: 'shipping',
    RETURN: 'return',
    REFUND: 'refund',
    PRODUCT_INFO: 'product_info',
    PAYMENT: 'payment',
    ACCOUNT: 'account',
    TECHNICAL: 'technical',
    OTHER: 'other',
  };
  return map[category];
}

function mapTicketChannel(
  channel: InternalSupportTicket['channel']
): 'web' | 'email' | 'phone' | 'chat' | 'social' | 'api' {
  const map: Record<InternalSupportTicket['channel'], 'web' | 'email' | 'phone' | 'chat' | 'social' | 'api'> = {
    WEB: 'web',
    EMAIL: 'email',
    PHONE: 'phone',
    CHAT: 'chat',
    SOCIAL: 'social',
    API: 'api',
  };
  return map[channel];
}

function mapResolutionType(
  type: InternalSupportTicket['resolutionType']
): 'refund' | 'replacement' | 'fix' | 'credit' | 'other' {
  const map: Record<NonNullable<InternalSupportTicket['resolutionType']>, 'refund' | 'replacement' | 'fix' | 'credit' | 'other'> = {
    REFUND: 'refund',
    REPLACEMENT: 'replacement',
    FIX: 'fix',
    CREDIT: 'credit',
    OTHER: 'other',
  };
  return map[type];
}

function mapAddressToSchema(
  address: Record<string, unknown>
): {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
} {
  return {
    '@type': 'PostalAddress',
    streetAddress: (address.streetAddress as string) ?? (address.address1 as string) ?? undefined,
    addressLocality: (address.city as string) ?? undefined,
    addressRegion: (address.state as string) ?? (address.province as string) ?? undefined,
    postalCode: (address.postalCode as string) ?? (address.zip as string) ?? undefined,
    addressCountry: (address.country as string) ?? undefined,
  };
}

// ============================================================================
// Batch Mapping
// ============================================================================

/**
 * Maps multiple products to Schema.org format
 */
export function mapProductsToSchema(products: InternalProduct[]): Product[] {
  return products.map(mapProductToSchema);
}

/**
 * Maps multiple orders to Schema.org format
 */
export function mapOrdersToSchema(orders: InternalOrder[]): Order[] {
  return orders.map(mapOrderToSchema);
}

/**
 * Maps multiple refunds to Schema.org format
 */
export function mapRefundsToSchema(refunds: InternalRefund[]): Refund[] {
  return refunds.map(mapRefundToSchema);
}

/**
 * Maps multiple tickets to Schema.org format
 */
export function mapSupportTicketsToSchema(
  tickets: InternalSupportTicket[]
): SupportTicket[] {
  return tickets.map(mapSupportTicketToSchema);
}

// ============================================================================
// Export
// ============================================================================

export type {
  // InternalProduct is exported as interface above
};
