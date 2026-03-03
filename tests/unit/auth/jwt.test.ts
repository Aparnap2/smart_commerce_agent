/**
 * JWT Auth Tests
 * 
 * Tests for signToken and verifyToken functions.
 */

import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, type TokenPayload } from '@/lib/auth/jwt';

describe('JWT Auth', () => {
  const mockPayload: TokenPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'SHOPPER',
  };

  it('should sign and verify token round-trip', async () => {
    const token = await signToken(mockPayload);
    const verified = await verifyToken(token);
    
    expect(verified.userId).toBe(mockPayload.userId);
    expect(verified.email).toBe(mockPayload.email);
    expect(verified.role).toBe(mockPayload.role);
  });

  it('should throw on tampered token', async () => {
    const token = await signToken(mockPayload);
    const tampered = token.slice(0, -5) + 'xxxxx';
    
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it('should throw on invalid token format', async () => {
    await expect(verifyToken('invalid-token')).rejects.toThrow();
  });
});
