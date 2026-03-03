export enum ErrorCode {
  OUT_OF_STOCK = 'INVENTORY_001',
  RESERVATION_EXPIRED = 'INVENTORY_002',
  PAYMENT_FAILED = 'PAYMENT_001',
  DUPLICATE_PAYMENT = 'PAYMENT_002',
  FORBIDDEN = 'AUTH_001',
  SESSION_EXPIRED = 'AUTH_002',
  CART_PRICE_CHANGED = 'CART_001',
  COUPON_EXPIRED = 'CART_002',
  LLM_TIMEOUT = 'AGENT_001',
  TOOL_EXECUTION_FAILED = 'AGENT_003',
}

export class CommerceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable: boolean,
    public httpStatus: number
  ) {
    super(message);
    this.name = 'CommerceError';
  }
}