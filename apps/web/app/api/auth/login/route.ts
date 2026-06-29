/**
 * Login API Route
 * 
 * Authenticates user and returns JWT token.
 */

import { Pool } from 'pg';
import { signToken, Role } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL 
    ? process.env.DATABASE_URL.replace('postgres:postgres', 'supabase_admin:postgres').replace('smart_commerce', 'postgres')
    : 'postgresql://supabase_admin:postgres@localhost:5433/postgres',
});

export async function POST(req: Request) {
  console.log('[Login] Starting login request');
  
  try {
    const { email, password } = await req.json();
    console.log('[Login] Received email:', email);
    
    if (!email || !password) {
      console.log('[Login] Missing email or password');
      return Response.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    console.log('[Login] Looking up user in database...');
    const result = await pool.query(
      'SELECT id, email, "passwordHash", role, "employeeRole", "departmentId" FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];
    console.log('[Login] Database query result:', { rowCount: result.rowCount });
    
    if (!user) {
      console.log('[Login] User not found - returning 401');
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    console.log('[Login] User found:', user.id);
    console.log('[Login] User email:', user.email);
    console.log('[Login] User passwordHash:', user.passwordHash);
    console.log('[Login] User role:', user.role);

    console.log('[Login] Comparing password...');
    console.log('[Login] Input password:', password);
    console.log('[Login] Stored hash:', user.passwordHash);
    
    // Try both bcrypt variants
    const hashFromDb = user.passwordHash;
    const isValid2b = await bcrypt.compare(password, hashFromDb);
    console.log('[Login] bcrypt.$2b result:', isValid2b);
    
    // Try fixing $2a vs $2b issue
    let passwordValid = isValid2b;
    if (!isValid2b && hashFromDb.startsWith('$2a$')) {
      const fixedHash = '$2b$' + hashFromDb.slice(4);
      passwordValid = await bcrypt.compare(password, fixedHash);
      console.log('[Login] bcrypt.$2a (fixed to $2b) result:', passwordValid);
    }
    
    console.log('[Login] Final password valid:', passwordValid);
    
    if (!passwordValid) {
      console.log('[Login] Password mismatch - returning 401');
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('[Login] Password valid, signing token...');
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: (user.role || 'EMPLOYEE') as Role,
      departmentId: user.department_id || null,
    });

    console.log('[Login] Token signed successfully');
    
    const res = Response.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role || 'EMPLOYEE',
        department_id: user.department_id 
      } 
    });
    
    // Set HTTP-only cookie - using SameSite=Lax for cookie persistence
    const cookieValue = `token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;
    console.log('[Login] Setting cookie:', cookieValue.split(';')[0]); // Only show token=xxx
    res.headers.set('Set-Cookie', cookieValue);
    
    console.log('[Login] Login successful, returning response');
    return res;
  } catch (error) {
    console.error('[Login] Error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
