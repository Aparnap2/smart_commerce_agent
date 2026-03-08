/**
 * Policy Engine for Returns and Refunds
 * 
 * Makes return/refund decisions explainable and consistent.
 * Configurable per merchant with default policy for TechTrend.
 */

// Refund method types
export type RefundMethod = 'replacement' | 'refund' | 'store_credit';

// Return condition types
export type ReturnCondition = 'defective' | 'wrong_item' | 'not_as_described' | 'changed_mind';

// Return option structure for UI presentation
export interface ReturnOption {
  method: RefundMethod;
  label: string;
  description: string;
  value: number;
  eta?: string;
}

// Return eligibility check result
export interface ReturnEligibilityResult {
  eligible: boolean;
  reason?: string;
}

// Return policy rules (configurable per merchant)
export interface ReturnPolicy {
  /** Number of days customer has to return items (e.g., 7 days for electronics) */
  returnWindowDays: number;
  
  /** Auto-approve returns within this window without manual review */
  autoApproveDays: number;
  
  /** Available refund methods for this merchant */
  refundMethods: RefundMethod[];
  
  /** Bonus percentage for choosing store credit (incentivizes retention) */
  storeCreditBonusPercent: number;
  
  /** Product categories that cannot be returned */
  excludedCategories: string[];
  
  /** Whether customer must specify item condition for return */
  conditionRequired: boolean;
}

/**
 * Default return policy for TechTrend merchant
 * 
 * This policy balances customer satisfaction with fraud prevention:
 * - 7-day return window (standard for electronics)
 * - 3-day auto-approve window for quick resolution
 * - 5% bonus for store credit (encourages retention)
 * - Excludes perishables, personal care, and digital goods
 */
export const defaultReturnPolicy: ReturnPolicy = {
  returnWindowDays: 7,
  autoApproveDays: 3,
  refundMethods: ['replacement', 'refund', 'store_credit'],
  storeCreditBonusPercent: 5,
  excludedCategories: ['perishables', 'personal_care', 'digital_goods'],
  conditionRequired: true,
};

/**
 * Check if an order is eligible for return based on policy rules
 * 
 * @param order - Order object with creation date and items
 * @param reason - Customer's reason for return
 * @returns Eligibility result with boolean and optional explanation
 * 
 * @example
 * ```typescript
 * const order = {
 *   createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
 *   items: [{ category: 'electronics' }]
 * };
 * const result = checkReturnEligibility(order, 'changed_mind');
 * // result: { eligible: true }
 * ```
 */
export function checkReturnEligibility(
  order: { createdAt: Date; items: Array<{ category: string }> },
  reason: ReturnCondition
): ReturnEligibilityResult {
  const orderAge = Date.now() - order.createdAt.getTime();
  const orderAgeDays = orderAge / (1000 * 60 * 60 * 24);

  // Check return window
  if (orderAgeDays > defaultReturnPolicy.returnWindowDays) {
    return { 
      eligible: false, 
      reason: `Return window expired (${Math.floor(orderAgeDays)} days ago)` 
    };
  }

  // Check excluded categories
  const excludedItem = order.items.find(item => 
    defaultReturnPolicy.excludedCategories.includes(item.category)
  );
  if (excludedItem) {
    return {
      eligible: false,
      reason: `${excludedItem.category} items cannot be returned`,
    };
  }

  // Defective items always eligible (consumer protection laws)
  if (reason === 'defective') {
    return { eligible: true };
  }

  return { eligible: true };
}

/**
 * Generate personalized return options based on policy and order details
 * 
 * @param orderTotal - Total order value in rupees
 * @param daysSinceOrder - Number of days since order was placed
 * @returns Array of return options with labels, values, and ETAs
 * 
 * @example
 * ```typescript
 * const options = generateReturnOptions(2999, 2);
 * // Returns replacement, refund, and store_credit options
 * // Store credit includes 5% bonus (₹150) since within auto-approve window
 * ```
 */
export function generateReturnOptions(
  orderTotal: number,
  daysSinceOrder: number
): ReturnOption[] {
  const options: ReturnOption[] = [];

  // Replacement option
  options.push({
    method: 'replacement' as RefundMethod,
    label: 'Replacement',
    description: 'New item shipped within 24 hours',
    value: orderTotal,
    eta: '2-3 days',
  });

  // Refund option
  options.push({
    method: 'refund' as RefundMethod,
    label: 'Refund',
    description: 'To original payment method',
    value: orderTotal,
    eta: '5-7 business days',
  });

  // Store credit (with bonus if within auto-approve window)
  const bonus = daysSinceOrder <= defaultReturnPolicy.autoApproveDays
    ? (orderTotal * defaultReturnPolicy.storeCreditBonusPercent / 100)
    : 0;

  options.push({
    method: 'store_credit' as RefundMethod,
    label: 'Store Credit',
    description: bonus > 0 
      ? `Instant credit + ₹${bonus} bonus` 
      : 'Instant credit to your account',
    value: orderTotal + bonus,
    eta: 'Instant',
  });

  return options;
}

/**
 * Determine if a return request qualifies for auto-approval
 * 
 * Auto-approval criteria:
 * 1. Within auto-approve window (3 days from order)
 * 2. Not defective (defective items need inspection)
 * 3. Order value < ₹5000 (high-value orders need manual review)
 * 
 * @param daysSinceOrder - Number of days since order was placed
 * @param reason - Customer's reason for return
 * @param orderTotal - Total order value in rupees
 * @returns True if return can be auto-approved without manual review
 * 
 * @example
 * ```typescript
 * const approved = isAutoApproved(2, 'changed_mind', 2999);
 * // true - within 3 days, not defective, under ₹5000
 * 
 * const notApproved = isAutoApproved(2, 'defective', 2999);
 * // false - defective items need inspection
 * ```
 */
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
