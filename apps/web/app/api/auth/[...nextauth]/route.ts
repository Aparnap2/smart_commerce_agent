/**
 * NextAuth Route - DISABLED
 * 
 * This route has been disabled. Authentication is now handled by Supabase Auth.
 * All authentication flows use: createBrowserClient from @supabase/ssr
 * 
 * If you see this message, the migration to Supabase Auth is complete.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'NextAuth has been disabled. Please use Supabase Auth.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'NextAuth has been disabled. Please use Supabase Auth.' },
    { status: 410 }
  );
}
