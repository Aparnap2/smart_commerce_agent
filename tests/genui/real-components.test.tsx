/**
 * REAL GenUI Components Test
 * 
 * Tests actual GenUI components rendering with real data:
 * - ProductCard
 * - OrderCard
 * - TicketStatus
 * 
 * Run: pnpm vitest run tests/genui/real-components.test.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import actual components
import { ProductCard, type ProductData } from '@/app/dashboard/components/genui/product-card';
import { OrderCard, type OrderData } from '@/app/dashboard/components/genui/order-card';
import { TicketStatus, type TicketStatus as TicketStatusType } from '@/app/dashboard/components/genui/ticket-status';

describe('REAL GenUI Components - Rendering Tests', () => {
  describe('ProductCard Component', () => {
    const mockProduct: ProductData = {
      id: 'prod_123',
      sku: 'LAPTOP-001',
      name: 'MacBook Pro 16"',
      description: 'High-performance laptop for professionals',
      price: 2499.99,
      originalPrice: 2799.99,
      currency: 'USD',
      category: 'Electronics',
      status: 'in_stock',
      stock: 15,
      lowStockThreshold: 5,
      rating: 4.8,
      reviewCount: 234,
      returnable: true,
      returnWindow: '30 days',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should render product name correctly', () => {
      render(<ProductCard data={mockProduct} />);
      
      const nameElement = screen.getByText('MacBook Pro 16"');
      expect(nameElement).toBeInTheDocument();
    });

    it('should render price correctly', () => {
      render(<ProductCard data={mockProduct} />);
      
      const priceElement = screen.getByText('$2,499.99');
      expect(priceElement).toBeInTheDocument();
    });

    it('should show discount when original price is provided', () => {
      render(<ProductCard data={mockProduct} />);
      
      // Should show original price with strikethrough
      const originalPrice = screen.getByText('$2,799.99');
      expect(originalPrice).toBeInTheDocument();
    });

    it('should display stock status correctly', () => {
      render(<ProductCard data={mockProduct} />);
      
      const statusElement = screen.getByText('In Stock');
      expect(statusElement).toBeInTheDocument();
    });

    it('should render rating stars', () => {
      render(<ProductCard data={mockProduct} />);
      
      // Should show rating
      const ratingElement = screen.getByText('4.8');
      expect(ratingElement).toBeInTheDocument();
      
      // Should show review count
      const reviewsElement = screen.getByText('(234 reviews)');
      expect(reviewsElement).toBeInTheDocument();
    });

    it('should render "Add to Cart" button', () => {
      render(<ProductCard data={mockProduct} />);
      
      const addButton = screen.getByRole('button', { name: /add to cart/i });
      expect(addButton).toBeInTheDocument();
    });

    it('should handle out of stock status', () => {
      const outOfStockProduct: ProductData = {
        ...mockProduct,
        status: 'out_of_stock',
        stock: 0,
      };

      render(<ProductCard data={outOfStockProduct} />);
      
      const statusElement = screen.getByText('Out of Stock');
      expect(statusElement).toBeInTheDocument();
    });

    it('should handle low stock status', () => {
      const lowStockProduct: ProductData = {
        ...mockProduct,
        status: 'low_stock',
        stock: 3,
      };

      render(<ProductCard data={lowStockProduct} />);
      
      const statusElement = screen.getByText('Low Stock');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('OrderCard Component', () => {
    const mockOrder: OrderData = {
      id: 'order_456',
      orderNumber: 'ORD-2024-001',
      customerId: 'cust_789',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'shipped',
      totalAmount: 1299.99,
      currency: 'USD',
      items: [
        {
          productId: 'prod_123',
          name: 'MacBook Pro 16"',
          quantity: 1,
          price: 1299.99,
        },
      ],
      shippingAddress: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        country: 'USA',
      },
      trackingNumber: '1Z999AA10123456784',
      trackingUrl: 'https://ups.com/track?tracknum=1Z999AA10123456784',
      orderDate: new Date().toISOString(),
      shippedDate: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('should render order number correctly', () => {
      render(<OrderCard data={mockOrder} />);
      
      const orderNumberElement = screen.getByText('ORD-2024-001');
      expect(orderNumberElement).toBeInTheDocument();
    });

    it('should render customer name', () => {
      render(<OrderCard data={mockOrder} />);
      
      const customerElement = screen.getByText('John Doe');
      expect(customerElement).toBeInTheDocument();
    });

    it('should render order total', () => {
      render(<OrderCard data={mockOrder} />);
      
      const totalElement = screen.getByText('$1,299.99');
      expect(totalElement).toBeInTheDocument();
    });

    it('should display order status', () => {
      render(<OrderCard data={mockOrder} />);
      
      const statusElement = screen.getByText(/shipped/i);
      expect(statusElement).toBeInTheDocument();
    });

    it('should render tracking number', () => {
      render(<OrderCard data={mockOrder} />);
      
      const trackingElement = screen.getByText('1Z999AA10123456784');
      expect(trackingElement).toBeInTheDocument();
    });

    it('should render tracking link', () => {
      render(<OrderCard data={mockOrder} />);
      
      const trackingLink = screen.getByRole('link', { name: /track/i });
      expect(trackingLink).toHaveAttribute('href', mockOrder.trackingUrl);
    });

    it('should handle pending status', () => {
      const pendingOrder: OrderData = {
        ...mockOrder,
        status: 'pending',
        trackingNumber: undefined,
        trackingUrl: undefined,
        shippedDate: undefined,
      };

      render(<OrderCard data={pendingOrder} />);
      
      const statusElement = screen.getByText(/pending/i);
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('TicketStatus Component', () => {
    it('should render open ticket status', () => {
      render(<TicketStatus status="open" />);
      
      const statusElement = screen.getByText('Open');
      expect(statusElement).toBeInTheDocument();
    });

    it('should render in-progress ticket status', () => {
      render(<TicketStatus status="in_progress" />);
      
      const statusElement = screen.getByText('In Progress');
      expect(statusElement).toBeInTheDocument();
    });

    it('should render resolved ticket status', () => {
      render(<TicketStatus status="resolved" />);
      
      const statusElement = screen.getByText('Resolved');
      expect(statusElement).toBeInTheDocument();
    });

    it('should render closed ticket status', () => {
      render(<TicketStatus status="closed" />);
      
      const statusElement = screen.getByText('Closed');
      expect(statusElement).toBeInTheDocument();
    });

    it('should apply correct color classes for open status', () => {
      const { container } = render(<TicketStatus status="open" />);
      
      const badge = container.querySelector('[class*="bg-"]');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('should apply correct color classes for urgent status', () => {
      const { container } = render(<TicketStatus status="urgent" />);
      
      const badge = container.querySelector('[class*="bg-"]');
      expect(badge).toHaveClass('bg-red-100');
    });
  });

  describe('GenUI Data Formatting', () => {
    it('should format currency correctly', () => {
      render(<ProductCard data={{
        id: 'test',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 1234.56,
        currency: 'USD',
        status: 'in_stock',
        stock: 10,
        lowStockThreshold: 5,
        rating: 4.5,
        reviewCount: 100,
        returnable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }} />);
      
      const priceElement = screen.getByText('$1,234.56');
      expect(priceElement).toBeInTheDocument();
    });

    it('should handle different currencies', () => {
      const { rerender } = render(<ProductCard data={{
        id: 'test',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 1234.56,
        currency: 'EUR',
        status: 'in_stock',
        stock: 10,
        lowStockThreshold: 5,
        rating: 4.5,
        reviewCount: 100,
        returnable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }} />);
      
      // Should show € symbol for EUR
      const priceElement = screen.getByText(/€1.234,56/);
      expect(priceElement).toBeInTheDocument();
    });

    it('should calculate discount percentage correctly', () => {
      render(<ProductCard data={{
        id: 'test',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 75.00,
        originalPrice: 100.00,
        currency: 'USD',
        status: 'in_stock',
        stock: 10,
        lowStockThreshold: 5,
        rating: 4.5,
        reviewCount: 100,
        returnable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }} />);
      
      // Should show 25% off
      const discountElement = screen.getByText('25% OFF');
      expect(discountElement).toBeInTheDocument();
    });
  });

  describe('GenUI Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ProductCard data={{
        id: 'test',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 99.99,
        currency: 'USD',
        status: 'in_stock',
        stock: 10,
        lowStockThreshold: 5,
        rating: 4.5,
        reviewCount: 100,
        returnable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }} />);
      
      // Should have proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have proper heading hierarchy', () => {
      render(<ProductCard data={{
        id: 'test',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 99.99,
        currency: 'USD',
        status: 'in_stock',
        stock: 10,
        lowStockThreshold: 5,
        rating: 4.5,
        reviewCount: 100,
        returnable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }} />);
      
      // Product name should be a heading
      const heading = screen.getByRole('heading');
      expect(heading).toHaveTextContent('Test Product');
    });
  });
});
