/**
 * GenUI Components Index
 *
 * Re-exports all GenUI components for the e-commerce agent.
 *
 * @packageDocumentation
 */

// Order components
export {
  OrderCard,
  OrderCardSkeleton,
  type OrderData,
} from './order-card.js';

// Product components
export {
  ProductCard,
  ProductCardSkeleton,
  ProductGrid,
  type ProductData,
} from './product-card.js';

// Ticket components
export {
  TicketStatus,
  TicketStatusSkeleton,
  TicketCardCompact,
  type TicketData,
  type TicketStatus as TicketStatusType,
  type TicketPriority,
  type TicketCategory,
  type TicketMessage,
} from './ticket-status.js';
