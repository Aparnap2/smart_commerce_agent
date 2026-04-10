'use client';

import React, { useMemo } from 'react';

export interface RevenueCardProps {
  title: string;
  revenue: number;
  previousRevenue?: number;
  period?: string;
  className?: string;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({
  title,
  revenue,
  previousRevenue,
  period = 'vs last period',
  className = '',
}) => {
  const percentChange = useMemo(() => {
    if (!previousRevenue || previousRevenue === 0) return null;
    return ((revenue - previousRevenue) / previousRevenue) * 100;
  }, [revenue, previousRevenue]);

  const isPositive = percentChange !== null && percentChange >= 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}
      role="region"
      aria-label={title}
      data-testid="revenue-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400" data-testid="revenue-card-title">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2" data-testid="revenue-card-value">
            ${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
      {percentChange !== null && (
        <div className="mt-4 flex items-center gap-1" data-testid="revenue-card-change">
          <span
            className={`text-sm font-medium ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{period}</span>
        </div>
      )}
    </div>
  );
};

export default RevenueCard;
