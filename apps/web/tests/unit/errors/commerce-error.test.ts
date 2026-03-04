import { describe, it, expect } from 'vitest'
import { CommerceError, ErrorCode } from '@smart-commerce/errors'

describe('CommerceError', () => {
  it('constructs with all required arguments', () => {
    const e = new CommerceError(
      ErrorCode.OUT_OF_STOCK,
      'Product P1 out of stock',
      false,
      400
    )
    expect(e.code).toBe(ErrorCode.OUT_OF_STOCK)
    expect(e.message).toBe('Product P1 out of stock')
    expect(e.retryable).toBe(false)
    expect(e.httpStatus).toBe(400)
    expect(e instanceof Error).toBe(true)
  })

  it('has correct error codes defined', () => {
    expect(ErrorCode.OUT_OF_STOCK).toBe('INVENTORY_001')
    expect(ErrorCode.PAYMENT_FAILED).toBe('PAYMENT_001')
    expect(ErrorCode.FORBIDDEN).toBe('AUTH_001')
    expect(ErrorCode.TOOL_EXECUTION_FAILED).toBe('AGENT_003')
  })

  it('can be thrown and caught', () => {
    const fn = () => {
      throw new CommerceError(
        ErrorCode.FORBIDDEN,
        'Access denied',
        false,
        403
      )
    }
    expect(fn).toThrow(CommerceError)
    expect(fn).toThrow('Access denied')
  })

  it('preserves all properties through throw/catch', () => {
    let caught: CommerceError | null = null
    try {
      throw new CommerceError(
        ErrorCode.TOOL_EXECUTION_FAILED,
        'Tool failed',
        true,
        500
      )
    } catch (e) {
      if (e instanceof CommerceError) caught = e
    }
    expect(caught?.code).toBe(ErrorCode.TOOL_EXECUTION_FAILED)
    expect(caught?.retryable).toBe(true)
    expect(caught?.httpStatus).toBe(500)
  })
})
