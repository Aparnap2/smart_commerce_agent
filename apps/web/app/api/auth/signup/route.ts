/**
 * Signup API Route
 * 
 * Creates new user account and returns JWT token.
 */

import { prisma } from '@/lib/prisma';
import { signToken, Role } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password, role = 'SHOPPER', name } = await req.json();
    
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: 'Email already taken' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role as Role,
        name,
      },
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    });

    const res = Response.json(
      { token, user: { id: user.id, email: user.email, role: user.role } },
      { status: 201 }
    );
    
    // Set HTTP-only cookie
    res.headers.set(
      'Set-Cookie',
      `token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 3600}`
    );
    
    return res;
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
