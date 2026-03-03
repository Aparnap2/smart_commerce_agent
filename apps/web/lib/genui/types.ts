/**
 * GenUI Action Types and Registry
 *
 * Type definitions for CopilotKit GenUI actions that render dynamic components.
 *
 * @file genui/types.ts
 */

import { z } from 'zod';

export const ProductDataSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  originalPrice: z.number().optional(),
  currency: z.string().default('USD'),
  category: z.string(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'discontinued']),
  stock: z.number(),
  lowStockThreshold: z.number(),
  rating: z.number(),
  reviewCount: z.number(),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  weight: z.number().optional(),
  dimensions: z
    .object({
      length: z.number(),
      width: z.number(),
      height: z.number(),
      unit: z.string(),
    })
    .optional(),
  warranty: z.string().optional(),
  returnable: z.boolean(),
  returnWindow: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductData = z.infer<typeof ProductDataSchema>;

export const OrderDataSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  total: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  shipping: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
      sku: z.string(),
    })
  ),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  estimatedDelivery: z.string().optional(),
  trackingNumber: z.string().optional(),
  customerId: z.string(),
  customerEmail: z.string(),
  customerName: z.string(),
  paymentMethod: z.string().optional(),
});

export type OrderData = z.infer<typeof OrderDataSchema>;

export const CartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
  sku: z.string().optional(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartDataSchema = z.object({
  items: z.array(CartItemSchema),
  total: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  shipping: z.number(),
  itemCount: z.number(),
});

export type CartData = z.infer<typeof CartDataSchema>;

export interface GenUIActionParams {
  showProductGrid: {
    products: ProductData[];
  };
  showOrderDetails: {
    order: OrderData;
  };
  showCart: {
    items: CartItem[];
    total: number;
  };
  addToCart: {
    productId: string;
    quantity: number;
  };
  checkout: Record<string, never>;
  trackOrder: {
    orderId: string;
  };
}

export type GenUIActionName = keyof GenUIActionParams;
