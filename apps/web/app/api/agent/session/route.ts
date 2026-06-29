/**
 * Session API Route
 *
 * Returns session info for the authenticated user.
 * Reads middleware-injected headers (x-user-id, x-role, x-sf-org)
 * and optionally resolves the user's display name from the database.
 *
 * Security: relies on middleware to inject x-user-id and x-role
 * from the JWT cookie before reaching this handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';

export async function GET(req: NextRequest) {
  // ── Read middleware-injected headers ────────────────────────────────
  const userId = req.headers.get('x-user-id');
  const role   = req.headers.get('x-role');
  const sfOrg  = req.headers.get('x-sf-org');

  if (!userId || !role) {
    return NextResponse.json(
      { error: 'Unauthorized — missing session' },
      { status: 401 },
    );
  }

  // ── Resolve display name from database (best-effort) ────────────────
  let name: string | undefined;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    name = user?.name ?? undefined;
  } catch {
    // DB not available (e.g., during development without Docker) — skip name
  }

  return NextResponse.json({
    userId,
    role,
    name,
    sfOrg: sfOrg ?? undefined,
  });
}
