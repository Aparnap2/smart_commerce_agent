// Department Budget API
// Returns department budget info for the authenticated user

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const BudgetResponseSchema = z.object({
  department: z.string(),
  monthlyBudget: z.number(),
  spent: z.number(),
  remaining: z.number(),
  percentUsed: z.number()
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's department
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        dept: true
      }
    })

    if (!user?.departmentId || !user.dept) {
      // Return default budget for users without department
      return NextResponse.json({
        department: 'General',
        monthlyBudget: 0,
        spent: 0,
        remaining: 0,
        percentUsed: 0
      })
    }

    const { dept } = user

    // Calculate remaining budget
    const remaining = dept.monthlyBudget - dept.spentThisMonth
    const percentUsed = dept.monthlyBudget > 0 
      ? Math.round((dept.spentThisMonth / dept.monthlyBudget) * 100)
      : 0

    const budgetData = {
      department: dept.name,
      monthlyBudget: dept.monthlyBudget,
      spent: dept.spentThisMonth,
      remaining: Math.max(0, remaining),
      percentUsed
    }

    // Validate response
    const validated = BudgetResponseSchema.parse(budgetData)

    return NextResponse.json(validated)
  } catch (error) {
    console.error('Error fetching department budget:', error)
    return NextResponse.json(
      { error: 'Failed to fetch department budget' },
      { status: 500 }
    )
  }
}