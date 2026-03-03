/**
 * Schema.org Commerce Schemas
 *
 * JSON-LD structured data schemas for e-commerce interoperability.
 * Provides type-safe Zod schemas for Product, Order, Refund, and SupportTicket
 * entities following Schema.org vocabulary.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Base Schema Types
// ============================================================================

/**
 * Schema.org context URL
 */
export const SchemaOrgContext = z.literal('https://schema.org');
export type SchemaOrgContext = z.infer<typeof SchemaOrgContext>;

/**
 * Base schema with required @context and @type
 */
export const BaseSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.string(),
});

/**
 * Monetary value schema
 */
export const MonetaryValueSchema = z.object({
  '@type': z.literal('MonetaryAmount').default('MonetaryAmount'),
  value: z.number().positive(),
  currency: z.string().default('USD'),
});

/**
 * Postal address schema
 */
export const PostalAddressSchema = z.object({
  '@type': z.literal('PostalAddress').default('PostalAddress'),
  streetAddress: z.string().optional(),
  addressLocality: z.string().optional(),
  addressRegion: z.string().optional(),
  postalCode: z.string().optional(),
  addressCountry: z.string().optional(),
});

export type PostalAddress = z.infer<typeof PostalAddressSchema>;

// ============================================================================
// Product Schema
// ============================================================================

/**
 * Product availability enumeration
 */
export const ProductAvailability = z.enum([
  'https://schema.org/InStock',
  'https://schema.org/OutOfStock',
  'https://schema.org/PreOrder',
  'https://schema.org/BackOrder',
  'https://schema.org/Discontinued',
  'https://schema.org/PreSale',
]);

/**
 * Product condition enumeration
 */
export const ProductCondition = z.enum([
  'https://schema.org/NewCondition',
  'https://schema.org/UsedCondition',
  'https://schema.org/RefurbishedCondition',
  'https://schema.org/DamagedCondition',
]);

/**
 * Offer schema for product pricing
 */
export const OfferSchema = z.object({
  '@type': z.literal('Offer').default('Offer'),
  price: z.number().nonnegative(),
  priceCurrency: z.string().default('USD'),
  availability: ProductAvailability.optional(),
  itemCondition: ProductCondition.optional(),
  sku: z.string().optional(),
  priceValidUntil: z.string().datetime().optional(),
  shippingDetails: z
    .object({
      '@type': z.literal('OfferShippingDetails').default('OfferShippingDetails'),
      shippingRate: MonetaryValueSchema.optional(),
      shippingDestination: z
        .object({
          '@type': z.literal('DefinedRegion').default('DefinedRegion'),
          addressCountry: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type Offer = z.infer<typeof OfferSchema>;

/**
 * Product rating schema
 */
export const AggregateRatingSchema = z.object({
  '@type': z.literal('AggregateRating').default('AggregateRating'),
  ratingValue: z.number().min(0).max(5),
  reviewCount: z.number().int().positive(),
  bestRating: z.number().min(0).max(5).default(5),
  worstRating: z.number().min(0).max(5).default(1),
});

export type AggregateRating = z.infer<typeof AggregateRatingSchema>;

/**
 * Product review schema
 */
export const ReviewSchema = z.object({
  '@type': z.literal('Review').default('Review'),
  author: z
    .object({
      '@type': z.literal('Person').default('Person'),
      name: z.string(),
    })
    .optional(),
  datePublished: z.string().datetime().optional(),
  reviewRating: z
    .object({
      '@type': z.literal('Rating').default('Rating'),
      ratingValue: z.number().min(0).max(5),
      bestRating: z.number().min(0).max(5).default(5),
      worstRating: z.number().min(0).max(5).default(1),
    })
    .optional(),
  reviewBody: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;

/**
 * Product schema following Schema.org Product
 * https://schema.org/Product
 */
export const ProductSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.literal('Product').default('Product'),
  /** Product SKU/identifier */
  sku: z.string(),
  /** Product name */
  name: z.string().min(1).max(500),
  /** Product description */
  description: z.string().max(5000).optional(),
  /** Product image URL */
  image: z.string().url().optional(),
  /** Product brand */
  brand: z
    .object({
      '@type': z.literal('Brand').default('Brand'),
      name: z.string(),
    })
    .optional(),
  /** Manufacturer information */
  manufacturer: z
    .object({
      '@type': z.literal('Organization').default('Organization'),
      name: z.string(),
    })
    .optional(),
  /** Product offers (pricing, availability) */
  offers: OfferSchema.optional(),
  /** Product category/breadcrumbs */
  category: z.array(z.string()).optional(),
  /** Product tags/keywords */
  keywords: z.array(z.string()).optional(),
  /** Product weight */
  weight: z
    .object({
      '@type': z.literal('QuantitativeValue').default('QuantitativeValue'),
      value: z.number().positive(),
      unitCode: z.string().default('kg'),
    })
    .optional(),
  /** Product dimensions */
  dimensions: z
    .object({
      '@type': z.literal('QuantitativeValue').default('QuantitativeValue'),
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      unitCode: z.string().default('cm'),
    })
    .optional(),
  /** Product aggregate rating */
  aggregateRating: AggregateRatingSchema.optional(),
  /** Product reviews */
  review: z.array(ReviewSchema).optional(),
  /** Product GTIN (barcode) */
  gtin: z.string().optional(),
  /** Product MPN (manufacturer part number) */
  mpn: z.string().optional(),
  /** Product ISBN */
  isbn: z.string().optional(),
  /** Product SKU variant */
  skuVariant: z.string().optional(),
  /** Additional product properties */
  additionalProperty: z
    .array(
      z.object({
        '@type': z.literal('PropertyValue').default('PropertyValue'),
        name: z.string(),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

export type Product = z.infer<typeof ProductSchema>;

// ============================================================================
// Order Schema
// ============================================================================

/**
 * Order status enumeration
 */
export const OrderStatus = z.enum([
  'https://schema.org/OrderCancelled',
  'https://schema.org/OrderDelivered',
  'https://schema.org/OrderInTransit',
  'https://schema.org/OrderPaymentDue',
  'https://schema.org/OrderPickupAvailable',
  'https://schema.org/OrderProblem',
  'https://schema.org/OrderProcessing',
  'https://schema.org/OrderReturned',
]);

/**
 * Delivery method schema
 */
export const DeliveryMethodSchema = z.object({
  '@type': z.literal('DeliveryMethod').default('DeliveryMethod'),
  name: z.string(),
});

export type DeliveryMethod = z.infer<typeof DeliveryMethodSchema>;

/**
 * Parcel delivery schema
 */
export const ParcelDeliverySchema = z.object({
  '@type': z.literal('ParcelDelivery').default('ParcelDelivery'),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  originAddress: PostalAddressSchema.optional(),
  destinationAddress: PostalAddressSchema.optional(),
  estimatedDeliveryDate: z.string().datetime().optional(),
  actualDeliveryTime: z.string().datetime().optional(),
  deliveryStatus: z
    .object({
      '@type': z.literal('DeliveryEvent').default('DeliveryEvent'),
      name: z.string(),
    })
    .optional(),
});

export type ParcelDelivery = z.infer<typeof ParcelDeliverySchema>;

/**
 * Order item schema
 */
export const OrderItemSchema = z.object({
  '@type': z.literal('OrderItem').default('OrderItem'),
  orderItemId: z.string().optional(),
  product: ProductSchema.optional(),
  quantity: z.number().int().positive().default(1),
  unitPrice: MonetaryValueSchema,
  totalPrice: MonetaryValueSchema.optional(),
  position: z.number().int().nonnegative().optional(),
  orderItemStatus: OrderStatus.optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * Order schema following Schema.org Order
 * https://schema.org/Order
 */
export const OrderSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.literal('Order').default('Order'),
  /** Order identifier (merchant-specific) */
  orderNumber: z.string(),
  /** Order status */
  orderStatus: OrderStatus,
  /** Customer email */
  customer: z
    .object({
      '@type': z.literal('Person').default('Person'),
      email: z.string().email(),
      name: z.string().optional(),
    })
    .optional(),
  /** Merchant/seller information */
  seller: z
    .object({
      '@type': z.literal('Organization').default('Organization'),
      name: z.string(),
      url: z.string().url().optional(),
    })
    .optional(),
  /** Order items */
  orderedItem: z.array(OrderItemSchema),
  /** Billing address */
  billingAddress: PostalAddressSchema.optional(),
  /** Shipping address */
  shippingAddress: PostalAddressSchema.optional(),
  /** Payment method */
  paymentMethod: z
    .object({
      '@type': z.literal('PaymentMethod').default('PaymentMethod'),
      name: z.string(),
    })
    .optional(),
  /** Payment status */
  paymentStatus: z
    .object({
      '@type': z.literal('PaymentStatus').default('PaymentStatus'),
      name: z.string(),
    })
    .optional(),
  /** Total price */
  totalPrice: MonetaryValueSchema.optional(),
  /** Discount/coupon applied */
  discount: z
    .object({
      '@type': z.literal('MonetaryAmount').default('MonetaryAmount'),
      value: z.number().nonnegative(),
      currency: z.string().default('USD'),
      code: z.string().optional(),
    })
    .optional(),
  /** Shipping method */
  shippingMethod: DeliveryMethodSchema.optional(),
  /** Parcel delivery tracking */
  parcelDelivery: ParcelDeliverySchema.optional(),
  /** Order creation date */
  orderDate: z.string().datetime(),
  /** Payment due date */
  paymentDueDate: z.string().datetime().optional(),
  /** Order date fulfilled */
  orderDateFulfilled: z.string().datetime().optional(),
  /** URL to order details */
  url: z.string().url().optional(),
  /** Additional notes */
  note: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

// ============================================================================
// Refund Schema
// ============================================================================

/**
 * Refund status enumeration
 */
export const RefundStatus = z.enum([
  'pending',
  'approved',
  'denied',
  'processing',
  'completed',
  'cancelled',
]);

/**
 * Reason for refund
 */
export const RefundReason = z.enum([
  'defective',
  'not_as_described',
  'wrong_item',
  'changed_mind',
  'duplicate_order',
  'other',
]);

/**
 * Refund schema for handling returns and refunds
 */
export const RefundSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.literal('Refund').default('Refund'),
  /** Refund identifier */
  refundId: z.string(),
  /** Original order number */
  orderNumber: z.string(),
  /** Customer identifier */
  customerId: z.string(),
  /** Refund amount */
  amount: MonetaryValueSchema,
  /** Refund status */
  status: RefundStatus,
  /** Reason for refund */
  reason: RefundReason,
  /** Customer-provided reason description */
  reasonDescription: z.string().optional(),
  /** Items being refunded */
  items: z.array(OrderItemSchema).optional(),
  /** Refund method */
  refundMethod: z.enum(['original_payment', 'store_credit', 'exchange']).default('original_payment'),
  /** Processing fee (if any) */
  processingFee: MonetaryValueSchema.optional(),
  /** Refund date requested */
  dateRequested: z.string().datetime(),
  /** Refund date processed */
  dateProcessed: z.string().datetime().optional(),
  /** Refund date completed */
  dateCompleted: z.string().datetime().optional(),
  /** Merchant notes */
  notes: z.string().optional(),
  /** Shipping return required */
  returnShippingRequired: z.boolean().default(false),
  /** Return shipping label provided */
  returnShippingLabel: z.string().url().optional(),
  /** Return tracking number */
  returnTrackingNumber: z.string().optional(),
});

export type Refund = z.infer<typeof RefundSchema>;

// ============================================================================
// SupportTicket Schema
// ============================================================================

/**
 * Ticket status enumeration
 */
export const TicketStatus = z.enum([
  'open',
  'in_progress',
  'pending_customer',
  'pending_merchant',
  'resolved',
  'closed',
]);

/**
 * Ticket priority enumeration
 */
export const TicketPriority = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Ticket channel enumeration
 */
export const TicketChannel = z.enum([
  'web',
  'email',
  'phone',
  'chat',
  'social',
  'api',
]);

/**
 * Ticket resolution schema
 */
export const TicketResolutionSchema = z.object({
  '@type': z.literal('TicketResolution').default('TicketResolution'),
  resolutionType: z.enum(['refund', 'replacement', 'fix', 'credit', 'other']),
  amount: MonetaryValueSchema.optional(),
  description: z.string().optional(),
  dateResolved: z.string().datetime().optional(),
});

export type TicketResolution = z.infer<typeof TicketResolutionSchema>;

/**
 * Support ticket schema for customer service
 */
export const SupportTicketSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.literal('SupportTicket').default('SupportTicket'),
  /** Ticket identifier */
  ticketId: z.string(),
  /** Related order number */
  orderNumber: z.string().optional(),
  /** Customer identifier */
  customerId: z.string(),
  /** Ticket subject/title */
  subject: z.string().min(1).max(500),
  /** Ticket description */
  description: z.string().max(10000),
  /** Ticket status */
  status: TicketStatus,
  /** Ticket priority */
  priority: TicketPriority.default('medium'),
  /** Ticket category */
  category: z.enum([
    'order_status',
    'shipping',
    'return',
    'refund',
    'product_info',
    'payment',
    'account',
    'technical',
    'other',
  ]),
  /** Communication channel */
  channel: TicketChannel.default('web'),
  /** Agent assigned to ticket */
  assignedTo: z
    .object({
      '@type': z.literal('Person').default('Person'),
      name: z.string(),
      email: z.string().email().optional(),
    })
    .optional(),
  /** Customer who created ticket */
  customer: z
    .object({
      '@type': z.literal('Person').default('Person'),
      name: z.string().optional(),
      email: z.string().email(),
    })
    .optional(),
  /** Date ticket created */
  dateCreated: z.string().datetime(),
  /** Date ticket last updated */
  dateUpdated: z.string().datetime().optional(),
  /** Date ticket resolved */
  dateResolved: z.string().datetime().optional(),
  /** Messages/comments on ticket */
  message: z
    .array(
      z.object({
        '@type': z.literal('Comment').default('Comment'),
        author: z
          .object({
            '@type': z.literal('Person').default('Person'),
            name: z.string(),
          })
          .optional(),
        datePublished: z.string().datetime(),
        text: z.string(),
        isInternal: z.boolean().default(false),
      })
    )
    .optional(),
  /** Resolution information */
  resolution: TicketResolutionSchema.optional(),
  /** Tags/labels */
  tags: z.array(z.string()).optional(),
  /** Related products */
  relatedProduct: z.array(ProductSchema).optional(),
  /** URL to ticket */
  url: z.string().url().optional(),
});

export type SupportTicket = z.infer<typeof SupportTicketSchema>;

// ============================================================================
// Cart Schema (Custom Extension)
// ============================================================================

/**
 * Cart item schema
 */
export const CartItemSchema = z.object({
  '@type': z.literal('CartItem').default('CartItem'),
  product: ProductSchema,
  quantity: z.number().int().positive().default(1),
  addedAt: z.string().datetime(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative().optional(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

/**
 * Shopping cart schema (custom extension to Schema.org)
 */
export const ShoppingCartSchema = z.object({
  '@context': SchemaOrgContext.default('https://schema.org'),
  '@type': z.literal('ShoppingCart').default('ShoppingCart'),
  /** Cart identifier */
  cartId: z.string(),
  /** Customer identifier */
  customerId: z.string(),
  /** Items in cart */
  item: z.array(CartItemSchema),
  /** Subtotal before discounts */
  subtotal: z.number().nonnegative(),
  /** Total discounts */
  discount: z.number().nonnegative().default(0),
  /** Shipping estimate */
  shippingEstimate: z.number().nonnegative().optional(),
  /** Tax estimate */
  taxEstimate: z.number().nonnegative().optional(),
  /** Total */
  total: z.number().nonnegative(),
  /** Currency */
  currency: z.string().default('USD'),
  /** Cart creation date */
  dateCreated: z.string().datetime(),
  /** Cart last updated */
  dateUpdated: z.string().datetime().optional(),
  /** Coupon codes applied */
  couponCode: z.array(z.string()).optional(),
  /** Expiration date */
  expiresAt: z.string().datetime().optional(),
});

export type ShoppingCart = z.infer<typeof ShoppingCartSchema>;

export const CommerceSchemas = {
  Product: ProductSchema,
  Order: OrderSchema,
  Refund: RefundSchema,
  SupportTicket: SupportTicketSchema,
  ShoppingCart: ShoppingCartSchema,
} as const;

export type CommerceSchemaType = keyof typeof CommerceSchemas;
