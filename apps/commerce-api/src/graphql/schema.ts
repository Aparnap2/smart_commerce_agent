import { createSchema } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';
import { queryResolvers } from './resolvers/query.js';
import { mutationResolvers } from './resolvers/mutation.js';

export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum OrderStatus {
    pending
    processing
    shipped
    delivered
    cancelled
  }

  enum RefundReason {
    defective
    not_as_described
    wrong_item
    changed_mind
    other
  }

  enum TicketCategory {
    order_status
    shipping
    return
    refund
    product_info
    payment
    account
    technical
    other
  }

  enum TicketPriority {
    low
    medium
    high
    urgent
  }

  enum TicketStatus {
    open
    in_progress
    resolved
    closed
  }

  enum RefundStatus {
    pending
    approved
    rejected
    processed
  }

  enum CouponType {
    percentage
    fixed
  }

  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    inventory: Int!
    category: String
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Order {
    id: ID!
    customerId: String!
    status: OrderStatus!
    total: Float
    items: [OrderItem!]!
    createdAt: DateTime
    updatedAt: DateTime
  }

  type OrderItem {
    id: ID!
    productId: String!
    quantity: Int!
    price: Float!
  }

  type Cart {
    id: ID!
    customerId: String!
    items: [CartItem!]!
    subtotal: Float!
    total: Float!
    couponCode: String
  }

  type CartItem {
    productId: ID!
    name: String!
    quantity: Int!
    price: Float!
  }

  type Refund {
    id: ID!
    orderId: String!
    customerId: String!
    reason: RefundReason!
    reasonDescription: String
    amount: Float
    status: RefundStatus!
    createdAt: DateTime
  }

  type SupportTicket {
    id: ID!
    customerId: String!
    orderId: String
    subject: String!
    description: String!
    category: TicketCategory!
    priority: TicketPriority!
    status: TicketStatus!
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Coupon {
    id: ID!
    code: String!
    discountType: CouponType!
    discountValue: Float!
    isActive: Boolean!
    expiresAt: DateTime
  }

  type OrdersResult {
    orders: [Order!]!
    count: Int!
    hasMore: Boolean!
  }

  type ProductsResult {
    products: [Product!]!
    query: String
    count: Int!
  }

  type ShippingAddress {
    street: String!
    city: String!
    state: String!
    zip: String!
    country: String!
  }

  type CheckoutSession {
    checkoutId: ID!
    cartId: String!
    paymentMethodId: String!
    shippingAddress: ShippingAddress!
    subtotal: Float!
    discount: Float!
    total: Float!
    status: String!
    createdAt: String!
  }

  type Query {
    # Order queries
    getOrder(orderId: ID!): OrderResult!
    listOrders(status: OrderStatus, limit: Int = 20, offset: Int = 0): OrdersListResult!
    
    # Product queries
    getProduct(productId: ID!): ProductResult!
    searchProducts(
      query: String!
      category: String
      minPrice: Float
      maxPrice: Float
      inStock: Boolean
      limit: Int = 10
    ): ProductsSearchResult!
    
    # Refund queries
    getRefundStatus(refundId: ID!): RefundResult!
    
    # Support ticket queries
    getTicketStatus(ticketId: ID!): TicketResult!
    
    # Cart queries
    getCart(cartId: ID): CartResult!
  }

  type Mutation {
    # Refund mutations
    createRefund(
      orderId: ID!
      reason: RefundReason!
      reasonDescription: String
      amount: Float
    ): RefundResult!
    
    # Support ticket mutations
    createSupportTicket(
      orderId: ID
      subject: String!
      description: String!
      category: TicketCategory!
      priority: TicketPriority = medium
    ): TicketResult!
    addTicketMessage(
      ticketId: ID!
      message: String!
      isInternal: Boolean = false
    ): TicketMessageResult!
    
    # Cart mutations
    addToCart(productId: ID!, quantity: Int! = 1): CartAddResult!
    updateCartQuantity(cartId: ID!, productId: Int!, quantity: Int!): CartUpdateResult!
    removeCartItem(cartId: ID!, productId: Int!): CartRemoveResult!
    clearCart(cartId: ID!): CartClearResult!
    applyCoupon(cartId: ID!, couponCode: String!): CouponResult!
    
    # Checkout mutations
    createCheckout(
      cartId: ID!
      paymentMethodId: String!
      shippingAddress: ShippingAddressInput!
    ): CheckoutResult!
    
    # Order mutations
    createOrderFromCart(cartId: ID!): OrderCreateResult!
    cancelOrder(orderId: ID!): OrderCancelResult!
  }

  # Result types
  type OrderResult {
    success: Boolean!
    order: Order
    error: String
  }

  type OrdersListResult {
    success: Boolean!
    data: OrdersResult
    error: String
  }

  type ProductResult {
    success: Boolean!
    product: Product
    error: String
  }

  type ProductsSearchResult {
    success: Boolean!
    data: ProductsResult
    error: String
  }

  type RefundResult {
    success: Boolean!
    refund: Refund
    error: String
  }

  type TicketResult {
    success: Boolean!
    ticket: SupportTicket
    error: String
  }

  type TicketMessageResult {
    success: Boolean!
    data: TicketMessageData
    error: String
  }

  type TicketMessageData {
    ticketId: ID!
    message: String!
    timestamp: String!
  }

  type CartResult {
    success: Boolean!
    data: CartData
    error: String
  }

  type CartData {
    cartId: ID!
    items: [CartItem!]!
    subtotal: Float!
    total: Float!
  }

  type CartAddResult {
    success: Boolean!
    data: CartAddData
    error: String
  }

  type CartAddData {
    cartId: ID!
    productId: ID!
    quantity: Int!
  }

  type CartUpdateResult {
    success: Boolean!
    data: CartUpdateData
    error: String
  }

  type CartUpdateData {
    cartId: ID!
    productId: Int!
    quantity: Int!
    updatedAt: DateTime
  }

  type CartRemoveResult {
    success: Boolean!
    data: CartRemoveData
    error: String
  }

  type CartRemoveData {
    cartId: ID!
    productId: Int!
    removed: Boolean!
    updatedAt: DateTime
  }

  type CartClearResult {
    success: Boolean!
    data: CartClearData
    error: String
  }

  type CartClearData {
    cartId: ID!
    clearedItems: Int!
    updatedAt: DateTime
  }

  type CouponResult {
    success: Boolean!
    data: CouponData
    error: String
  }

  type CouponData {
    cartId: ID!
    couponCode: String!
    discountType: CouponType!
    discountValue: Float!
    discount: Float!
    newTotal: Float!
    updatedAt: DateTime
  }

  type CheckoutResult {
    success: Boolean!
    data: CheckoutSession
    error: String
  }

  type OrderCreateResult {
    success: Boolean!
    data: OrderCreateData
    error: String
  }

  type OrderCreateData {
    orderId: ID!
    cartId: ID!
    status: String!
    itemCount: Int!
    createdAt: String!
  }

  type OrderCancelResult {
    success: Boolean!
    data: OrderCancelData
    error: String
  }

  type OrderCancelData {
    orderId: ID!
    status: String!
    cancelledAt: String!
  }

  input ShippingAddressInput {
    street: String!
    city: String!
    state: String!
    zip: String!
    country: String!
  }
`;

export interface Context {
  db: PrismaClient;
  userId: string | null;
}

export const createGraphQLSchema = (db: PrismaClient) => {
  return createSchema({
    typeDefs,
    resolvers: {
      Query: queryResolvers(db),
      Mutation: mutationResolvers(db),
    },
  });
};
