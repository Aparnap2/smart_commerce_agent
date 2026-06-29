// PR Approval Decision API
// Allows manager to approve or reject a PR

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma/client'
import { EmployeeRole, PRStatus, ApprovalStatus } from '@prisma/client'
import { z } from 'zod'

// Type for the function response - function returns JSONB directly
type DbFunctionResult = {
  success: boolean;
  error?: string;
  prId?: string;
  amount?: number;
};

const DecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ prId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prId } = await params

    // Validate request body
    const body = await request.json()
    const { decision, comments } = DecisionSchema.parse(body)

    // Get user and check manager role
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.employeeRole !== EmployeeRole.MANAGER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find the PR
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: {
        department: true
      }
    })

    if (!pr) {
      return NextResponse.json({ error: 'PR not found' }, { status: 404 })
    }

    // Verify manager is the approver for this department
    if (pr.department.approverEmail !== session.user.email) {
      return NextResponse.json({ error: 'Not authorized to approve this PR' }, { status: 403 })
    }

    // Update PR status
    const newStatus = decision === 'APPROVED' ? PRStatus.APPROVED : PRStatus.REJECTED
    let updatedPR;

    if (decision === 'APPROVED') {
      // Use the database function to handle budget debit and status update atomically
      // The function returns JSONB directly, so we cast it
      const result = await prisma.$queryRaw<[DbFunctionResult]>`
        SELECT * FROM approve_pr_and_debit_budget(${prId}::TEXT)
      `
      
      const functionResponse = result[0]
      if (!functionResponse || !functionResponse.success) {
        return NextResponse.json(
          { error: functionResponse?.error || 'Failed to approve PR and debit budget' },
          { status: 400 }
        )
      }

      // Fetch the updated PR after the function call
      updatedPR = await prisma.purchaseRequest.findUnique({
        where: { id: prId }
      })
    } else {
      // For REJECTED, just update the status (no budget debit needed)
      updatedPR = await prisma.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: newStatus,
          notes: comments || null,
          rejectedAt: new Date()
        }
      })
    }

    if (!updatedPR) {
      return NextResponse.json({ error: 'Failed to update PR' }, { status: 500 })
    }

    // Create audit entry
    await prisma.pRAuditEntry.create({
      data: {
        action: decision === 'APPROVED' ? 'PR_APPROVED' : 'PR_REJECTED',
        actor: session.user.email,
        details: {
          decision,
          comments,
          approverEmail: session.user.email,
          approverName: user.name
        },
        prId
      }
    })

    // Create approval record
    await prisma.pRApproval.create({
      data: {
        status: decision === 'APPROVED' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        approverEmail: session.user.email,
        approverName: user.name || null,
        comments: comments || null,
        decidedAt: new Date(),
        prId
      }
    })

    // Resume the LangGraph thread if there's an approval thread ID
    // Note: approvalThreadId field not in schema - skipping for now

    return NextResponse.json({
      success: true,
      prId: updatedPR.id,
      prNumber: updatedPR.prNumber,
      status: updatedPR.status
    })
  } catch (error) {
    console.error('Error processing approval decision:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    )
  }
}