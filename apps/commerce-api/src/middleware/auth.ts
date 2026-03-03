import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { getCookie } from 'hono/cookie';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? getCookie(c, 'token');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const { payload } = await jwtVerify(token, SECRET);
    c.set('userId', payload.userId as string);
    c.set('role', payload.role as string);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
