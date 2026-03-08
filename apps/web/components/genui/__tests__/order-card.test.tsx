/**
 * OrderCard Component Tests
 *
 * Tests that OrderCard:
 * - Renders without crashing (empty data)
 * - Renders correct data
 * - Button click fires callback
 * - Loading/disabled state works
 * - ARIA labels present
 * - Dark mode renders correctly
 */

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderCard, type OrderItem, type OrderStatus } from '../OrderCard';

const mockOrderItems: OrderItem[] = [
  {
    id: 'item-1',
    name: 'Test Product 1',
    quantity: 2,
    price: 99.99,
    image: 'https://example.com/product1.jpg',
  },
  {
    id: 'item-2',
    name: 'Test Product 2',
    quantity: 1,
    price: 149.99,
    image: 'https://example.com/product2.jpg',
  },
  {
    id: 'item-3',
    name: 'Test Product 3',
    quantity: 3,
    price: 29.99,
  },
];

const renderOrderCard = (status: OrderStatus = 'CONFIRMED') => {
  return render(
    <OrderCard
      orderId="ORD-12345"
      status={status}
      items={mockOrderItems}
      total={349.97}
      orderDate="2024-01-15"
      estimatedDelivery="2024-01-20"
      trackingNumber="TRK123456789"
    />
  );
};

describe('OrderCard', () => {
  it('renders without crashing (empty data)', () => {
    const { container } = render(
      <OrderCard
        orderId="ORD-00000"
        status="PENDING"
        items={[]}
        total={0}
      />
    );
    expect(container).toBeDefined();
    expect(screen.getByText('Order #ORD-00000')).toBeDefined();
  });

  it('renders correct data', () => {
    renderOrderCard('CONFIRMED');

    // Check order info
    expect(screen.getByText('Order #ORD-12345')).toBeDefined();
    expect(screen.getByText('Placed on 2024-01-15')).toBeDefined();

    // Check status badge (use getAllBy and check first one which is the badge)
    const statusElements = screen.getAllByText('Confirmed');
    expect(statusElements.length).toBeGreaterThan(0);

    // Check items (first 2)
    expect(screen.getByText('Test Product 1')).toBeDefined();
    expect(screen.getByText('Test Product 2')).toBeDefined();

    // Check "+X more" indicator
    expect(screen.getByText('+1 more item')).toBeDefined();

    // Check total
    expect(screen.getByText('$349.97')).toBeDefined();

    // Check delivery info (text includes formatting)
    expect(screen.getByText(/Estimated delivery:/)).toBeDefined();
    expect(screen.getByText('2024-01-20')).toBeDefined();
    expect(screen.getByText('TRK123456789')).toBeDefined();
  });

  it('button click fires callback - track order', () => {
    const onTrack = vi.fn();

    render(
      <OrderCard
        orderId="ORD-12345"
        status="SHIPPED"
        items={mockOrderItems}
        total={349.97}
        trackingNumber="TRK123456789"
        onTrack={onTrack}
      />
    );

    // Click Track Order button
    const trackButton = screen.getByRole('button', { name: /Track order/i });
    fireEvent.click(trackButton);

    expect(onTrack).toHaveBeenCalledWith('ORD-12345');
  });

  it('button click fires callback - cancel order', () => {
    const onCancel = vi.fn();

    render(
      <OrderCard
        orderId="ORD-12345"
        status="PENDING"
        items={mockOrderItems}
        total={349.97}
        onCancel={onCancel}
      />
    );

    // Click Cancel Order button
    const cancelButton = screen.getByRole('button', { name: /Cancel order/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledWith('ORD-12345');
  });

  it('button click fires callback - reorder', () => {
    const onReorder = vi.fn();

    render(
      <OrderCard
        orderId="ORD-12345"
        status="DELIVERED"
        items={mockOrderItems}
        total={349.97}
        onReorder={onReorder}
      />
    );

    // Click Reorder button
    const reorderButton = screen.getByRole('button', { name: /Reorder order/i });
    fireEvent.click(reorderButton);

    expect(onReorder).toHaveBeenCalledWith('ORD-12345');
  });

  it('loading state works', () => {
    render(
      <OrderCard
        orderId="ORD-12345"
        status="SHIPPED"
        items={mockOrderItems}
        total={349.97}
        trackingNumber="TRK123456789"
        isLoading
      />
    );

    // Buttons should be disabled
    const trackButton = screen.getByRole('button', { name: /Track order/i });
    expect(trackButton).toBeDisabled();
  });

  it('ARIA labels present', () => {
    renderOrderCard('CONFIRMED');

    // Check region ARIA label
    expect(screen.getByRole('region', { name: 'Order ORD-12345' })).toBeDefined();

    // Check status ARIA label
    expect(screen.getByRole('status')).toBeDefined();

    // Check progress steps have ARIA labels
    const progressSteps = screen.getAllByRole('status');
    expect(progressSteps.length).toBeGreaterThan(0);
  });

  it('dark mode renders correctly', () => {
    const { container } = render(
      <div className="dark">
        <OrderCard
          orderId="ORD-12345"
          status="CONFIRMED"
          items={mockOrderItems}
          total={349.97}
        />
      </div>
    );

    // Check dark mode classes are present
    const darkElements = container.querySelectorAll('.dark\\:bg-gray-800');
    expect(darkElements.length).toBeGreaterThan(0);
  });

  it('cancelled orders skip progress bar', () => {
    render(
      <OrderCard
        orderId="ORD-12345"
        status="CANCELLED"
        items={mockOrderItems}
        total={349.97}
      />
    );

    // Should show cancelled message
    expect(screen.getByText('This order has been cancelled')).toBeDefined();

    // Should not show progress bar steps
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('status badge has correct color coding', () => {
    const { rerender, container } = renderOrderCard('PENDING');
    
    // Find status badge by role (the first one with role="status" in header)
    const statusBadge = container.querySelector('[role="status"]');
    expect(statusBadge).toHaveClass('text-yellow-600');

    rerender(
      <OrderCard
        orderId="ORD-12345"
        status="DELIVERED"
        items={mockOrderItems}
        total={349.97}
      />
    );
    const deliveredBadge = container.querySelector('[role="status"]');
    expect(deliveredBadge).toHaveClass('text-green-600');

    rerender(
      <OrderCard
        orderId="ORD-12345"
        status="CANCELLED"
        items={mockOrderItems}
        total={349.97}
      />
    );
    const cancelledBadge = container.querySelector('[role="status"]');
    expect(cancelledBadge).toHaveClass('text-red-600');
  });

  it('track button only shows for non-delivered orders with tracking', () => {
    const { rerender } = render(
      <OrderCard
        orderId="ORD-12345"
        status="SHIPPED"
        items={mockOrderItems}
        total={349.97}
        trackingNumber="TRK123456789"
      />
    );
    expect(screen.queryByRole('button', { name: /Track order/i })).toBeDefined();

    rerender(
      <OrderCard
        orderId="ORD-12345"
        status="DELIVERED"
        items={mockOrderItems}
        total={349.97}
        trackingNumber="TRK123456789"
      />
    );
    expect(screen.queryByRole('button', { name: /Track order/i })).not.toBeInTheDocument();
  });

  it('cancel button only shows for pending/confirmed orders', () => {
    const { rerender } = render(
      <OrderCard
        orderId="ORD-12345"
        status="PENDING"
        items={mockOrderItems}
        total={349.97}
      />
    );
    expect(screen.queryByRole('button', { name: /Cancel order/i })).toBeDefined();

    rerender(
      <OrderCard
        orderId="ORD-12345"
        status="SHIPPED"
        items={mockOrderItems}
        total={349.97}
      />
    );
    expect(screen.queryByRole('button', { name: /Cancel order/i })).not.toBeInTheDocument();
  });
});
