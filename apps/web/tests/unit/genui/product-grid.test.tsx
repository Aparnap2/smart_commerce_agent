/**
 * ProductGrid Component Tests
 * 
 * Tests that ProductGrid:
 * - Renders correct number of ProductCard components
 * - Renders empty state when products array is empty
 * - Calls onAddToCart callback with correct productId and quantity
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductGrid } from '../../../app/dashboard/components/genui/product-grid';
import type { ProductData } from '../../../lib/genui/types';

const mockProducts: ProductData[] = [
  {
    id: '1',
    sku: 'SKU001',
    name: 'Test Product 1',
    price: 99.99,
    currency: 'USD',
    category: 'Electronics',
    status: 'in_stock',
    stock: 10,
    lowStockThreshold: 5,
    rating: 4.5,
    reviewCount: 100,
    returnable: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    sku: 'SKU002',
    name: 'Test Product 2',
    price: 149.99,
    currency: 'USD',
    category: 'Electronics',
    status: 'in_stock',
    stock: 5,
    lowStockThreshold: 5,
    rating: 4.0,
    reviewCount: 50,
    returnable: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

describe('ProductGrid', () => {
  it('should render correct number of ProductCard components', () => {
    const mockOnAddToCart = vi.fn();
    
    render(
      <ProductGrid 
        products={mockProducts} 
        onAddToCart={mockOnAddToCart}
      />
    );

    // Should render 2 product cards (by name)
    expect(screen.getByText('Test Product 1')).toBeDefined();
    expect(screen.getByText('Test Product 2')).toBeDefined();
  });

  it('should render empty state message when products array is empty', () => {
    render(
      <ProductGrid 
        products={[]} 
      />
    );

    // Should render empty state
    expect(screen.getByText('No products found')).toBeDefined();
    expect(screen.getByText("Try adjusting your search or filters")).toBeDefined();
  });

  it('should call onAddToCart callback with correct productId and quantity', () => {
    const mockOnAddToCart = vi.fn();
    
    render(
      <ProductGrid 
        products={mockProducts} 
        onAddToCart={mockOnAddToCart}
      />
    );

    // Find and click "Add to Cart" button on first product
    const addToCartButtons = screen.getAllByText('Add to Cart');
    addToCartButtons[0].click();

    // Should call callback with product ID and default quantity (1)
    expect(mockOnAddToCart).toHaveBeenCalledWith('1', 1);
  });

  it('should render products with correct prices', () => {
    render(
      <ProductGrid products={mockProducts} />
    );

    // Check prices are rendered (format: $XX.XX)
    expect(screen.getByText('$99.99')).toBeDefined();
    expect(screen.getByText('$149.99')).toBeDefined();
  });
});
