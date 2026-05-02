export const RETURN_WINDOW_DAYS = 7
export const AUTO_APPROVE_DAYS = 3
export const STORE_CREDIT_BONUS = 500

type Order = {
  id: number
  total: number
  orderDate: Date
  status: string
  [key: string]: unknown
}

export type RefundOption = {
  type: 'replacement' | 'refund' | 'store_credit'
  label: string
  description: string
  amount: number
  bonus?: number
}

export function isWithinReturnWindow(order: Order): boolean {
  const now = new Date()
  const orderDate = new Date(order.orderDate)
  const diffMs = now.getTime() - orderDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= RETURN_WINDOW_DAYS
}

export function getRefundOptions(order: Order): RefundOption[] {
  return [
    {
      type: 'replacement',
      label: 'Replacement',
      description: 'Get a brand new replacement delivered in 3-5 days',
      amount: order.total,
    },
    {
      type: 'refund',
      label: 'Refund to original payment',
      description: `₹${order.total.toLocaleString('en-IN')} refunded in 5-7 business days`,
      amount: order.total,
    },
    {
      type: 'store_credit',
      label: 'Store Credit',
      description: `₹${(order.total + STORE_CREDIT_BONUS).toLocaleString('en-IN')} store credit — includes ₹500 bonus`,
      amount: order.total + STORE_CREDIT_BONUS,
      bonus: STORE_CREDIT_BONUS,
    },
  ]
}

export function autoApprove(order: Order): boolean {
  const now = new Date()
  const orderDate = new Date(order.orderDate)
  const diffMs = now.getTime() - orderDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays < AUTO_APPROVE_DAYS
}

// Existing exports from the original file
export type RefundMethod = 'replacement' | 'refund' | 'store_credit';
export type ReturnCondition = 'defective' | 'wrong_item' | 'not_as_described' | 'changed_mind';
export interface ReturnOption {
  method: RefundMethod;
  label: string;
  description: string;
  value: number;
  eta?: string;
}
export interface ReturnEligibilityResult {
  eligible: boolean;
  reason?: string;
}
export interface ReturnPolicy {
  returnWindowDays: number;
  autoApproveDays: number;
  refundMethods: RefundMethod[];
  storeCreditBonusPercent: number;
  excludedCategories: string[];
  conditionRequired: boolean;
}
export const defaultReturnPolicy: ReturnPolicy = {
  returnWindowDays: 7,
  autoApproveDays: 3,
  refundMethods: ['replacement', 'refund', 'store_credit'],
  storeCreditBonusPercent: 5,
  excludedCategories: ['perishables', 'personal_care', 'digital_goods'],
  conditionRequired: true,
};
export function checkReturnEligibility(
  order: { createdAt: Date; items: Array<{ category: string }> },
  reason: ReturnCondition
): ReturnEligibilityResult {
  const orderAge = Date.now() - order.createdAt.getTime();
  const orderAgeDays = orderAge / (1000 * 60 * 60 * 24);
  if (orderAgeDays > defaultReturnPolicy.returnWindowDays) {
    return { eligible: false, reason: `Return window expired (${Math.floor(orderAgeDays)} days ago)` };
  }
  const excludedItem = order.items.find(item => 
    defaultReturnPolicy.excludedCategories.includes(item.category)
  );
  if (excludedItem) {
    return { eligible: false, reason: `${excludedItem.category} items cannot be returned` };
  }
  if (reason === 'defective') {
    return { eligible: true };
  }
  return { eligible: true };
}
export function generateReturnOptions(
  orderTotal: number,
  daysSinceOrder: number
): ReturnOption[] {
  const options: ReturnOption[] = [];
  options.push({
    method: 'replacement',
    label: 'Replacement',
    description: 'New item shipped within 24 hours',
    value: orderTotal,
    eta: '2-3 days',
  });
  options.push({
    method: 'refund',
    label: 'Refund',
    description: 'To original payment method',
    value: orderTotal,
    eta: '5-7 business days',
  });
  const bonus = daysSinceOrder <= defaultReturnPolicy.autoApproveDays
    ? (orderTotal * defaultReturnPolicy.storeCreditBonusPercent / 100)
    : 0;
  options.push({
    method: 'store_credit',
    label: 'Store Credit',
    description: bonus > 0 
      ? `Instant credit + ₹${bonus} bonus` 
      : 'Instant credit to your account',
    value: orderTotal + bonus,
    eta: 'Instant',
  });
  return options;
}
export function isAutoApproved(
  daysSinceOrder: number,
  reason: ReturnCondition,
  orderTotal: number
): boolean {
  return (
    daysSinceOrder <= defaultReturnPolicy.autoApproveDays &&
    reason !== 'defective' &&
    orderTotal < 5000
  );
}
