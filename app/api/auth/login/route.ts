/**
 * Login API Route
 * 
 * Authenticates user and returns JWT token.
 */

import { prisma } from '@/lib/prisma';
import { signToken, Role } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    });

    const res = Response.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    
    // Set HTTP-only cookie
    res.headers.set(
      'Set-Cookie',
      `token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 3600}`
    );
    
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
