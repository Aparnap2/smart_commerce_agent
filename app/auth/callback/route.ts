/**
 * Auth Callback Route - Handles OAuth redirects and session exchange
 *
 * This route is called after OAuth providers redirect back to the app.
 * It exchanges the authorization code for a session.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /auth/callback
 * Handles the OAuth callback from Supabase and exchanges the code for a session
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // If there's no code, redirect to login with error
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  // Create server client with cookie handling
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
            // Ignore errors during callback
          }
        },
        remove(name: string, options: { path?: string; domain?: string }) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch {
            // Ignore errors during callback
          }
        },
      },
    }
  );

  // Exchange the code for a session
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[Auth Callback] Session exchange error:', error.message);
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  // Successful authentication - redirect to dashboard or specified next page
  return NextResponse.redirect(`${origin}${next}`);
}
