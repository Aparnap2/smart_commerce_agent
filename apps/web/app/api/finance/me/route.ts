import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(request: Request) {
  const role = request.headers.get('x-role')
  const userId = request.headers.get('x-user-id')

  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
      : null

    return NextResponse.json({
      userId,
      role,
      name: user?.name ?? user?.email ?? 'Finance User',
    })
  } catch {
    return NextResponse.json({ userId, role, name: 'Finance User' })
  }
}
