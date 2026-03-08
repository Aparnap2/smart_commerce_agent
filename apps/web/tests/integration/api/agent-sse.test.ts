/**
 * Agent SSE Integration Tests
 * 
 * Tests for /api/agent SSE streaming endpoint.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { signToken } from '@/lib/auth/jwt';

describe('/api/agent SSE', () => {
  const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let validToken: string;

  beforeAll(async () => {
    validToken = await signToken({
      userId: 'test-user-123',
      email: 'test@example.com',
      role: 'SHOPPER',
    });
  });

  it('should return SSE stream with valid JWT', async () => {
    const res = await fetch(`${API_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({ message: 'show me headphones' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('should return 401 without token', async () => {
    const res = await fetch(`${API_URL}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 400 without message', async () => {
    const res = await fetch(`${API_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
