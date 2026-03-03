export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  brand?: string;
  description?: string;
  urgencyCopy?: string;
  merchantId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  priceAt: number;
  product?: Product;
  priceChanged?: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  discount: number;
  couponCode?: string;
  crossSell?: Product[];
}

export interface Order {
  id: string;
  customerId: string;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  priceAt: number;
  total: number;
  product?: Product;
}

export interface UserContext {
  cart: Cart | null;
  recentOrders: Order[];
  tasteVector: number[];
  pendingNotifications: AgentNotification[];
  preferences: UserPreferences;
}

export interface AgentNotification {
  id: string;
  type: string;
  payload: string;
  read: boolean;
  expiresAt?: string;
}

export interface UserPreferences {
  priceRange?: { min: number; max: number };
  preferredCategories?: string[];
}

export type Role = 'SHOPPER' | 'MERCHANT' | 'SUPPORT' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'FAILED';
