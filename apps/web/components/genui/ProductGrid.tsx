'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * ProductGrid Component
 * 
 * A horizontal scroll-snap product carousel for inline chat stream rendering.
 * Features:
 * - Horizontal scroll-snap carousel
 * - 220-240px card width
 * - Image with lazy loading
 * - Add to Cart + View Details buttons
 * - Out of stock overlay
 * - Low stock warning
 * - Dark mode support
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Touch-friendly (44px minimum tap targets)
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  inStock: boolean;
  stockCount?: number;
  description?: string;
}

export interface ProductGridProps {
  products: Product[];
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  isLoading?: boolean;
  className?: string;
  /** Compact summary for AIState (~100 tokens) */
  summary?: string;
}

const LOW_STOCK_THRESHOLD = 5;

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onAddToCart,
  onViewDetails,
  isLoading = false,
  className = '',
  summary,
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Handle horizontal scroll with keyboard
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const scrollAmount = 240; // Approximately one card width

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          break;
      }
    },
    []
  );

  // Track scroll position for navigation buttons
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollPosition(containerRef.current.scrollLeft);
  }, []);

  // Scroll handlers
  const scrollLeft = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: -240, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: 240, behavior: 'smooth' });
  }, []);

  // Check if we can scroll in each direction
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = containerRef.current
    ? scrollPosition < containerRef.current.scrollWidth - containerRef.current.clientWidth - 10
    : false;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`flex gap-4 overflow-x-auto pb-4 animate-pulse ${className}`}
        role="region"
        aria-label="Loading products"
        aria-busy="true"
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[220px] bg-gray-200 dark:bg-gray-700 rounded-lg h-[320px]"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (!products || products.length === 0) {
    return (
      <div
        className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}
        role="region"
        aria-label="Products"
      >
        <p>No products available</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} role="region" aria-label="Product carousel">
      {/* Navigation Buttons */}
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          aria-label="Scroll left"
          type="button"
        >
          <svg
            className="w-6 h-6 text-gray-800 dark:text-gray-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Product Carousel */}
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        tabIndex={0}
        role="list"
        aria-label="Product list"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-x',
        }}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
            onViewDetails={onViewDetails}
            isLoading={isLoading}
          />
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          aria-label="Scroll right"
          type="button"
        >
          <svg
            className="w-6 h-6 text-gray-800 dark:text-gray-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  isLoading?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onViewDetails,
  isLoading = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOutOfStock = !product.inStock;
  const isLowStock = product.inStock && (product.stockCount ?? 0) < LOW_STOCK_THRESHOLD;
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  const handleAddToCart = useCallback(() => {
    if (!isOutOfStock && onAddToCart) {
      onAddToCart(product);
    }
  }, [product, onAddToCart, isOutOfStock]);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails(product);
    }
  }, [product, onViewDetails]);

  return (
    <div
      className="flex-shrink-0 w-[220px] sm:w-[240px] bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden snap-start focus-within:ring-2 focus-within:ring-blue-500"
      role="listitem"
    >
      {/* Image Container */}
      <div className="relative h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-600" />
        )}
        
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-300 ${
              imageLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div
            className="absolute inset-0 bg-black/60 flex items-center justify-center"
            aria-label="Out of stock"
          >
            <span className="text-white font-semibold text-lg">Out of Stock</span>
          </div>
        )}

        {/* Low Stock Warning */}
        {isLowStock && !isOutOfStock && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded">
            Only {product.stockCount} left!
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && !isOutOfStock && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
            {Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)}% OFF
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 min-h-[2.5rem]">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="mb-4">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ${product.price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                ${product.originalPrice!.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ${product.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleViewDetails}
            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            aria-label={`View details for ${product.name}`}
            type="button"
          >
            View Details
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isLoading}
            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
            aria-label={
              isOutOfStock
                ? `${product.name} is out of stock`
                : `Add ${product.name} to cart`
            }
            type="button"
          >
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;
