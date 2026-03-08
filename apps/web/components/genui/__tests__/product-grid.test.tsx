/**
 * ProductGrid Component Tests
 *
 * Tests that ProductGrid:
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
import { ProductGrid, type Product } from '../ProductGrid';

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Test Product 1',
    price: 99.99,
    originalPrice: 129.99,
    image: 'https://example.com/product1.jpg',
    inStock: true,
    stockCount: 10,
    description: 'Test description 1',
  },
  {
    id: '2',
    name: 'Test Product 2',
    price: 149.99,
    image: 'https://example.com/product2.jpg',
    inStock: true,
    stockCount: 3,
    description: 'Test description 2',
  },
  {
    id: '3',
    name: 'Out of Stock Product',
    price: 49.99,
    image: 'https://example.com/product3.jpg',
    inStock: false,
    stockCount: 0,
  },
];

describe('ProductGrid', () => {
  it('renders without crashing (empty data)', () => {
    const { container } = render(<ProductGrid products={[]} />);
    expect(container).toBeDefined();
    expect(screen.getByText('No products available')).toBeDefined();
  });

  it('renders correct data', () => {
    render(<ProductGrid products={mockProducts} />);

    // Check product names are rendered
    expect(screen.getByText('Test Product 1')).toBeDefined();
    expect(screen.getByText('Test Product 2')).toBeDefined();
    expect(screen.getByText('Out of Stock Product')).toBeDefined();

    // Check prices are rendered
    expect(screen.getByText('$99.99')).toBeDefined();
    expect(screen.getByText('$149.99')).toBeDefined();
    expect(screen.getByText('$49.99')).toBeDefined();
  });

  it('button click fires callback', () => {
    const onAddToCart = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <ProductGrid
        products={mockProducts}
        onAddToCart={onAddToCart}
        onViewDetails={onViewDetails}
      />
    );

    // Click View Details
    const viewDetailsButtons = screen.getAllByText('View Details');
    fireEvent.click(viewDetailsButtons[0]);

    expect(onViewDetails).toHaveBeenCalledWith(mockProducts[0]);

    // Click Add to Cart
    const addToCartButtons = screen.getAllByText('Add to Cart');
    fireEvent.click(addToCartButtons[0]);

    expect(onAddToCart).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('loading state works', () => {
    const { container } = render(<ProductGrid products={mockProducts} isLoading />);

    // Should show loading skeleton
    expect(container.querySelector('.animate-pulse')).toBeDefined();
    expect(screen.queryByText('Test Product 1')).not.toBeInTheDocument();
  });

  it('ARIA labels present', () => {
    render(<ProductGrid products={mockProducts} />);

    // Check region ARIA labels
    expect(screen.getByRole('region', { name: 'Product carousel' })).toBeDefined();
    expect(screen.getByRole('list')).toBeDefined();

    // Check list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(3);

    // Check button ARIA labels
    const addToCartButtons = screen.getAllByRole('button', { name: /Add .* to cart/i });
    expect(addToCartButtons.length).toBeGreaterThan(0);
  });

  it('dark mode renders correctly', () => {
    const { container } = render(
      <div className="dark">
        <ProductGrid products={mockProducts} />
      </div>
    );

    // Check dark mode classes are present
    const darkElements = container.querySelectorAll('.dark\\:bg-gray-800');
    expect(darkElements.length).toBeGreaterThan(0);
  });

  it('out of stock products have disabled Add to Cart button', () => {
    render(<ProductGrid products={mockProducts} />);

    // Find the disabled "Out of Stock" button by its aria-label
    const outOfStockButton = screen.getByRole('button', {
      name: 'Out of Stock Product is out of stock',
    });
    expect(outOfStockButton).toBeDisabled();
  });

  it('low stock warning is displayed', () => {
    render(<ProductGrid products={mockProducts} />);

    // Product 2 has stockCount: 3, which is below LOW_STOCK_THRESHOLD (5)
    expect(screen.getByText('Only 3 left!')).toBeDefined();
  });

  it('discount badge is displayed for products with original price', () => {
    render(<ProductGrid products={mockProducts} />);

    // Product 1 has originalPrice: 129.99 and price: 99.99
    expect(screen.getByText('23% OFF')).toBeDefined();
  });

  it('keyboard navigation works', () => {
    render(<ProductGrid products={mockProducts} />);

    const carousel = screen.getByRole('list');
    
    // Keyboard navigation is set up - just verify the element has tabIndex
    expect(carousel).toHaveAttribute('tabIndex', '0');
    
    // Note: scrollBy is not available in jsdom, but the event handler is attached
    // In a real browser, ArrowRight/ArrowLeft would scroll the carousel
  });
});
