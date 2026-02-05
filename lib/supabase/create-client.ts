/**
 * Supabase Client Factory - Creates browser/client Supabase instances
 */

import { createClient as createSupabaseClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// ============================================================================
// Client Creation
// ============================================================================

/**
 * Create a Supabase client for browser/client components
 * This is the main client instance used throughout the app
 */
export function createClient(): SupabaseClient {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );
}

/**
 * Get current session from client
 */
export async function getClientSession(): Promise<Session | null> {
  const client = createClient();
  const { data: { session } } = await client.auth.getSession();
  return session;
}

/**
 * Get current user from client
 */
export async function getClientUser(): Promise<User | null> {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email: string, password: string) {
  const client = createClient();
  return client.auth.signInWithPassword({ email, password });
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, options?: { data?: Record<string, unknown> }) {
  const client = createClient();
  return client.auth.signUp({
    email,
    password,
    options: options ? { data: options.data } : undefined,
  });
}

/**
 * Sign out
 */
export async function signOut() {
  const client = createClient();
  return client.auth.signOut();
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
  const client = createClient();
  return client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

/**
 * Reset password for email
 */
export async function resetPassword(email: string) {
  const client = createClient();
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
}

// ============================================================================
// Type Exports
// ============================================================================

export type { Session, User };
