'use client';

import React from 'react';

export interface MetricItem {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
}

export interface MerchantBriefingCardProps {
  title: string;
  metrics: MetricItem[];
  className?: string;
}

export const MerchantBriefingCard: React.FC<MerchantBriefingCardProps> = ({
  title,
  metrics,
  className = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}
      role="region"
      aria-label={title}
      data-testid="merchant-briefing-card"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4" data-testid="merchant-briefing-title">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4" data-testid="merchant-briefing-metrics">
        {metrics.map((metric, index) => (
          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
            </p>
            {metric.change !== undefined && (
              <p
                className={`text-xs mt-1 ${
                  metric.change >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {metric.change >= 0 ? '+' : ''}{metric.change}% {metric.changeLabel}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MerchantBriefingCard;
