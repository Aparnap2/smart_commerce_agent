/**
 * CartCanvas Component Tests
 *
 * Tests that CartCanvas:
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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartCanvas, type CartItem } from '../CartCanvas';

const mockCartItems: CartItem[] = [
  {
    id: 'cart-1',
    productId: '1',
    name: 'Test Product 1',
    price: 99.99,
    originalPrice: 129.99,
    quantity: 2,
    image: 'https://example.com/product1.jpg',
    maxQuantity: 10,
  },
  {
    id: 'cart-2',
    productId: '2',
    name: 'Test Product 2',
    price: 149.99,
    quantity: 1,
    image: 'https://example.com/product2.jpg',
  },
];

describe('CartCanvas', () => {
  it('renders without crashing (empty data)', () => {
    const { container } = render(<CartCanvas items={[]} />);
    expect(container).toBeDefined();
    expect(screen.getByText('Your cart is empty')).toBeDefined();
  });

  it('renders correct data', () => {
    render(<CartCanvas items={mockCartItems} />);

    // Check cart header
    expect(screen.getByText('Your Cart (2 items)')).toBeDefined();

    // Check product names
    expect(screen.getByText('Test Product 1')).toBeDefined();
    expect(screen.getByText('Test Product 2')).toBeDefined();

    // Check quantities
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();

    // Check prices
    expect(screen.getByText('$99.99')).toBeDefined();
    expect(screen.getByText('$149.99')).toBeDefined();

    // Check totals
    expect(screen.getByText('Subtotal')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
  });

  it('button click fires callback - quantity change', () => {
    const onQuantityChange = vi.fn();

    render(
      <CartCanvas
        items={mockCartItems}
        onQuantityChange={onQuantityChange}
      />
    );

    // Click increment button for first item
    const incrementButtons = screen.getAllByRole('button', { name: /Increase quantity/i });
    fireEvent.click(incrementButtons[0]);

    expect(onQuantityChange).toHaveBeenCalledWith('cart-1', 3);

    // Click decrement button for first item
    const decrementButtons = screen.getAllByRole('button', { name: /Decrease quantity/i });
    fireEvent.click(decrementButtons[0]);

    expect(onQuantityChange).toHaveBeenCalledWith('cart-1', 1);
  });

  it('button click fires callback - remove item', async () => {
    const onRemove = vi.fn();

    render(
      <CartCanvas
        items={mockCartItems}
        onRemove={onRemove}
      />
    );

    // Click remove button for first item
    const removeButtons = screen.getAllByRole('button', { name: /Remove .* from cart/i });
    fireEvent.click(removeButtons[0]);

    // Wait for the removal animation
    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith('cart-1');
    }, { timeout: 1000 });
  });

  it('button click fires callback - checkout', () => {
    const onCheckout = vi.fn();

    render(
      <CartCanvas
        items={mockCartItems}
        onCheckout={onCheckout}
      />
    );

    // Click checkout button
    const checkoutButton = screen.getByRole('button', { name: /Proceed to checkout/i });
    fireEvent.click(checkoutButton);

    expect(onCheckout).toHaveBeenCalled();
  });

  it('loading state works', () => {
    render(<CartCanvas items={mockCartItems} isLoading />);

    // Checkout button should be disabled
    const checkoutButton = screen.getByRole('button', { name: /Proceed to checkout/i });
    expect(checkoutButton).toBeDisabled();
    expect(checkoutButton).toHaveTextContent('Processing...');
  });

  it('ARIA labels present', () => {
    render(<CartCanvas items={mockCartItems} />);

    // Check region ARIA label
    expect(screen.getByRole('region', { name: 'Shopping cart' })).toBeDefined();

    // Check coupon input ARIA label
    expect(screen.getByRole('textbox', { name: 'Coupon code input' })).toBeDefined();

    // Check buttons have ARIA labels
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('dark mode renders correctly', () => {
    const { container } = render(
      <div className="dark">
        <CartCanvas items={mockCartItems} />
      </div>
    );

    // Check dark mode classes are present
    const darkElements = container.querySelectorAll('.dark\\:bg-gray-800');
    expect(darkElements.length).toBeGreaterThan(0);
  });

  it('coupon code input works', () => {
    render(<CartCanvas items={mockCartItems} />);

    const couponInput = screen.getByRole('textbox', { name: 'Coupon code input' });
    
    // Type coupon code
    fireEvent.change(couponInput, { target: { value: 'SAVE10' } });
    expect(couponInput).toHaveValue('SAVE10');

    // Click apply button
    const applyButton = screen.getByRole('button', { name: 'Apply coupon code' });
    fireEvent.click(applyButton);
  });

  it('price breakdown is calculated correctly', () => {
    render(<CartCanvas items={mockCartItems} />);

    // Subtotal should be (99.99 * 2) + (149.99 * 1) = 349.97
    // The component shows formatted prices
    expect(screen.getByText('Subtotal')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    
    // Check that the total is displayed (formatted as $XXX.XX)
    // Use getAllBy since there may be multiple instances (subtotal and total)
    const totalElements = screen.getAllByText('$349.97');
    expect(totalElements.length).toBeGreaterThan(0);
  });

  it('quantity controls respect max quantity', () => {
    const onQuantityChange = vi.fn();

    render(
      <CartCanvas
        items={[{ ...mockCartItems[0], quantity: 10 }]}
        onQuantityChange={onQuantityChange}
      />
    );

    // Increment button should be disabled at max quantity
    const incrementButton = screen.getByRole('button', { name: /Increase quantity/i });
    expect(incrementButton).toBeDisabled();
  });

  it('decrement button disabled at quantity 1', () => {
    const onQuantityChange = vi.fn();

    render(
      <CartCanvas
        items={[{ ...mockCartItems[0], quantity: 1 }]}
        onQuantityChange={onQuantityChange}
      />
    );

    // Decrement button should be disabled at quantity 1
    const decrementButton = screen.getByRole('button', { name: /Decrease quantity/i });
    expect(decrementButton).toBeDisabled();
  });
});
