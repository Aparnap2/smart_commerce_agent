// Pending Approvals Count API
// Returns count of pending PRs for the manager

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma/client'
import { EmployeeRole, PRStatus } from '@prisma/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    // Only managers see pending count
    if (!user || user.employeeRole !== EmployeeRole.MANAGER) {
      return NextResponse.json({ count: 0 })
    }

    if (!user.departmentId) {
      return NextResponse.json({ count: 0 })
    }

    const pendingCount = await prisma.purchaseRequest.count({
      where: {
        departmentId: user.departmentId,
        status: PRStatus.PENDING_APPROVAL,
        submittedAt: { not: null }
      }
    })

    return NextResponse.json({ count: pendingCount })
  } catch (error) {
    console.error('Error fetching pending count:', error)
    return NextResponse.json({ count: 0 })
  }
}