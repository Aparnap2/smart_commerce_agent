/**
 * ProductGrid Component
 * 
 * Displays products in a responsive grid layout.
 * Integrates with CopilotKit for AI-driven product discovery.
 */

'use client';

import React from 'react';
import { ProductCard, type ProductData } from './product-card';

export interface ProductGridProps {
  products: ProductData[];
  onAddToCart?: (productId: string, quantity: number) => void;
  onViewDetails?: (productId: string) => void;
  onAddToWishlist?: (productId: string) => void;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function ProductGrid({
  products,
  onAddToCart,
  onViewDetails,
  onAddToWishlist,
  className = '',
  columns = 4,
}: ProductGridProps) {
  const columnClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  if (!products || products.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid ${columnClasses[columns]} gap-6 ${className}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          showQuantitySelector
          showActions
          onAddToCart={onAddToCart}
          onViewDetails={onViewDetails}
          onAddToWishlist={onAddToWishlist}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
