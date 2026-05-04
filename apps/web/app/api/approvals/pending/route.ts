// Pending Approvals API
// Returns PRs pending approval for the manager

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

    // Check if user is a manager
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.employeeRole !== EmployeeRole.MANAGER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's department
    if (!user.departmentId) {
      return NextResponse.json({ approvals: [] })
    }

    // Find pending PRs for this department
    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: {
        departmentId: user.departmentId,
        status: PRStatus.PENDING_APPROVAL,
        submittedAt: { not: null }
      },
      include: {
        requestor: {
          select: {
            name: true,
            email: true
          }
        },
        lineItems: {
          include: {
            catalogItem: true
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    })

    const approvals = pendingPRs.map(pr => ({
      id: pr.id,
      prNumber: pr.prNumber,
      requestorName: pr.requestor.name || pr.requestor.email,
      totalAmount: pr.totalAmount,
      lineItems: pr.lineItems.map(item => ({
        id: item.id,
        name: item.catalogItem.name,
        vendor: item.catalogItem.vendor,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      justification: pr.justification,
      urgency: pr.urgency,
      threadId: null // Thread ID would come from chat context
    }))

    return NextResponse.json({ approvals })
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    )
  }
}