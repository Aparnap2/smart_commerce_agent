import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { getCookie } from 'hono/cookie';

const SECRET = process.env.JWT_SECRET 
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? getCookie(c, 'token');
  
  if (!token || !SECRET) {
    // Allow unauthenticated requests - resolvers will handle auth
    c.set('userId', null);
    await next();
    return;
  }
  
  try {
    const { payload } = await jwtVerify(token, SECRET);
    c.set('userId', payload.userId as string);
    c.set('role', payload.role as string);
    await next();
  } catch {
    // Allow unauthenticated requests - resolvers will handle auth
    c.set('userId', null);
    await next();
  }
});
