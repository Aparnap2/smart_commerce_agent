import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(request: Request) {
  const role = request.headers.get('x-role')
  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })

    const data = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      monthlyBudget: dept.monthlyBudget,
      spent: dept.spentThisMonth,
      remaining: Math.max(0, dept.monthlyBudget - dept.spentThisMonth),
      percentUsed: dept.monthlyBudget > 0
        ? Math.round((dept.spentThisMonth / dept.monthlyBudget) * 100)
        : 0,
    }))

    return NextResponse.json({ departments: data })
  } catch (error) {
    console.error('Error fetching budget by department:', error)
    return NextResponse.json({ error: 'Failed to fetch budget data' }, { status: 500 })
  }
}
