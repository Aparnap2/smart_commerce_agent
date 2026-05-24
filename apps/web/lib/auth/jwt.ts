/**
 * JWT Authentication Module
 * 
 * Custom JWT implementation replacing Supabase Auth.
 * Uses jose for sign/verify operations.
 * 
 * Supports both B2C (SHOPPER/MERCHANT/SUPPORT/ADMIN) and
 * B2B procurement (EMPLOYEE/MANAGER/FINANCE/ADMIN) roles.
 */

import { SignJWT, jwtVerify, JWTVerifyResult } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/** B2C e-commerce roles */
export type Role = 'SHOPPER' | 'MERCHANT' | 'SUPPORT' | 'ADMIN';

/** B2B procurement roles */
export type B2BRole = 'EMPLOYEE' | 'MANAGER' | 'FINANCE' | 'ADMIN';

/** Union of all application roles */
export type AppRole = Role | B2BRole;

export interface TokenPayload {
  userId: string;
  email: string;
  role: AppRole;
  departmentId?: string | null;
}

/**
 * Sign a JWT token with user payload
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

/**
 * Verify a JWT token and return payload
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as unknown as TokenPayload;
}
