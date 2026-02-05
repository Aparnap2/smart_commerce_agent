/**
 * Supabase Server Client - For Server Components and API Routes
 *
 * Handles cookies and session management for server-side operations.
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

/**
 * Create a server client with cookie handling
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: { path?: string; domain?: string; sameSite?: 'lax' | 'strict' | 'none'; secure?: boolean; httpOnly?: boolean; maxAge?: number }) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignore errors in server context
          }
        },
        remove(name: string, options: { path?: string; domain?: string }) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch {
            // Ignore errors in server context
          }
        },
      },
    }
  );
}

/**
 * Get session from server context
 */
export async function getServerSession() {
  const client = await createServerSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  return session;
}

/**
 * Get user from server context
 */
export async function getServerUser() {
  const client = await createServerSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Require authentication (redirect if not authenticated)
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

/**
 * Require specific role(s)
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await getServerSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  const { data: profile } = await (await createServerSupabaseClient())
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error('FORBIDDEN');
  }

  return session;
}
