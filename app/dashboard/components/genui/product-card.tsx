/**
 * ProductCard Component
 *
 * Displays product information in a card format for the e-commerce agent.
 * Supports streaming updates, pricing displays, and action buttons.
 *
 * @packageDocumentation
 */

'use client';

import React from 'react';
import {
  Star,
  ShoppingCart,
  Heart,
  Share2,
  Tag,
  Package,
  AlertCircle,
  CheckCircle,
  Minus,
  Plus,
  ChevronRight,
  XCircle,
} from 'lucide-react';

// Product status types
type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';

// Product data interface
export interface ProductData {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category: string;
  subcategory?: string;
  brand?: string;
  status: ProductStatus;
  stock: number;
  lowStockThreshold: number;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  images?: string[];
  tags?: string[];
  features?: string[];
  specifications?: Record<string, string>;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  warranty?: string;
  returnable: boolean;
  returnWindow?: string;
  createdAt: string;
  updatedAt: string;
}

// Status configuration
const statusConfig: Record<ProductStatus, { color: string; icon: React.ElementType; label: string }> = {
  in_stock: {
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    icon: CheckCircle,
    label: 'In Stock',
  },
  low_stock: {
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon: AlertCircle,
    label: 'Low Stock',
  },
  out_of_stock: {
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon: XCircle,
    label: 'Out of Stock',
  },
  discontinued: {
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    icon: Package,
    label: 'Discontinued',
  },
};

// Default status if mapping fails
const defaultStatus = {
  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  icon: Package,
  label: 'Product',
};

// Format currency
function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

// Render stars for rating
function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-300 dark:text-gray-600'
            }`}
        />
      ))}
      <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
        ({reviewCount} reviews)
      </span>
    </div>
  );
}

// Stock indicator
function StockIndicator({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) {
    return (
      <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="w-4 h-4" />
        <span>Out of Stock</span>
      </div>
    );
  }

  if (stock <= threshold) {
    return (
      <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-4 h-4" />
        <span>Only {stock} left</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
      <CheckCircle className="w-4 h-4" />
      <span>In Stock ({stock})</span>
    </div>
  );
}

// Price display component
function PriceDisplay({
  price,
  originalPrice,
}: {
  price: number;
  originalPrice?: number;
}) {
  if (originalPrice && originalPrice > price) {
    const discountPercent = Math.round((1 - price / originalPrice) * 100);

    return (
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatPrice(price)}
        </span>
        <span className="text-lg text-gray-400 line-through">
          {formatPrice(originalPrice)}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          {discountPercent}% off
        </span>
      </div>
    );
  }

  return (
    <span className="text-2xl font-bold text-gray-900 dark:text-white">
      {formatPrice(price)}
    </span>
  );
}

// Product features list
function ProductFeatures({ features }: { features?: string[] }) {
  if (!features || features.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Key Features
      </h4>
      <ul className="space-y-1">
        {features.slice(0, 4).map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Product specifications
function ProductSpecifications({ specs }: { specs?: Record<string, string> }) {
  if (!specs || Object.keys(specs).length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Specifications
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {Object.entries(specs)
          .slice(0, 6)
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-gray-500 dark:text-gray-400">{key}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

// Tags display
function ProductTags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {tags.slice(0, 4).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          <Tag className="w-3 h-3" />
          {tag}
        </span>
      ))}
    </div>
  );
}

// Quantity selector
interface QuantitySelectorProps {
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
}

function QuantitySelector({ quantity, max, onChange }: QuantitySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
        className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>
      <span className="w-12 text-center font-medium text-gray-900 dark:text-white">
        {quantity}
      </span>
      <button
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
}

// Main ProductCard component
interface ProductCardProps {
  product: ProductData;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  onAddToCart?: (productId: string, quantity: number) => void;
  onAddToWishlist?: (productId: string) => void;
  onShare?: (productId: string) => void;
  onViewDetails?: (productId: string) => void;
  className?: string;
  showQuantitySelector?: boolean;
  showActions?: boolean;
}

export function ProductCard({
  product,
  quantity = 1,
  onQuantityChange,
  onAddToCart,
  onAddToWishlist,
  onShare,
  onViewDetails,
  className = '',
  showQuantitySelector = false,
  showActions = true,
}: ProductCardProps) {
  const status = statusConfig[product.status] || defaultStatus;
  const StatusIcon = status.icon;
  const canAddToCart = product.status === 'in_stock' || product.status === 'low_stock';

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Image section */}
      <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
        <div className="absolute inset-0 flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
          )}
        </div>
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
        </div>
        {/* Wishlist button */}
        {showActions && onAddToWishlist && (
          <button
            onClick={() => onAddToWishlist(product.id)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
          </button>
        )}
      </div>

      {/* Content section */}
      <div className="p-4">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {product.category}
          </span>
          {product.brand && (
            <>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {product.brand}
              </span>
            </>
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
          {product.name}
        </h3>

        {/* SKU */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          SKU: {product.sku}
        </p>

        {/* Rating */}
        <div className="mb-3">
          <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        </div>

        {/* Price */}
        <div className="mb-3">
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} />
        </div>

        {/* Stock */}
        <div className="mb-3">
          <StockIndicator stock={product.stock} threshold={product.lowStockThreshold} />
        </div>

        {/* Features */}
        <ProductFeatures features={product.features} />

        {/* Specifications */}
        <ProductSpecifications specs={product.specifications} />

        {/* Tags */}
        <ProductTags tags={product.tags} />

        {/* Return policy */}
        {product.returnable && (
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>
              {product.returnWindow || '30-day'} return eligible
            </span>
          </div>
        )}
      </div>

      {/* Actions section */}
      {showActions && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {/* Quantity selector */}
            {showQuantitySelector && canAddToCart && onQuantityChange && (
              <QuantitySelector
                quantity={quantity}
                max={product.stock}
                onChange={onQuantityChange}
              />
            )}

            {/* Add to cart */}
            {canAddToCart && onAddToCart && (
              <button
                onClick={() => onAddToCart(product.id, quantity)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
            )}

            {/* Share button */}
            {onShare && (
              <button
                onClick={() => onShare(product.id)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}

            {/* View details */}
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(product.id)}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Details
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ProductCard skeleton for loading states
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200 dark:bg-gray-700" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded" />
        </div>
        <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
        <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-600 rounded mb-3" />
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded" />
          ))}
        </div>
        <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-600 rounded mb-3" />
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-600 rounded" />
      </div>
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-600 rounded" />
      </div>
    </div>
  );
}

// Grid wrapper for multiple products
interface ProductGridProps {
  products: ProductData[];
  children: (product: ProductData, index: number) => React.ReactNode;
  className?: string;
}

export function ProductGrid({ products, children, className = '' }: ProductGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
      {products.map((product, index) => children(product, index))}
    </div>
  );
}

export default ProductCard;
