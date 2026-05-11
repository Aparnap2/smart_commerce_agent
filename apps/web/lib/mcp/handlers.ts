import { prisma } from '@/lib/db/client'
import { checkIdempotencyKey, setIdempotencyKey, setUserContext } from '@/lib/redis/memory'
import { z } from 'zod'

export type PRWithItems = {
  id: string
  prNumber: string
  status: string
  total: number
  departmentId: string
  requestedBy: string
  lineItems: PRLineItem[]
}

export type PRLineItem = {
  catalogItemId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

const searchCatalogSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  limit: z.number().min(1).max(50).default(20),
})

export async function searchCatalogHandler(
  params: { query?: string; category?: string; vendor?: string; minPrice?: number; maxPrice?: number; limit?: number },
  userId: string
): Promise<Array<{ id: string; name: string; price: number; vendor: string; category: string; stock: number }>> {
  const { query, category, vendor, minPrice, maxPrice, limit } = searchCatalogSchema.parse(params)

  const where: Record<string, unknown> = { status: 'active' }
  if (query) where.OR = [
    { name: { contains: query, mode: 'insensitive' } },
    { description: { contains: query, mode: 'insensitive' } },
    { sku: { contains: query, mode: 'insensitive' } },
  ]
  if (category) where.category = category
  if (vendor) where.vendor = vendor
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined) (where.price as Record<string, number>).gte = minPrice
    if (maxPrice !== undefined) (where.price as Record<string, number>).lte = maxPrice
  }

  const items = await prisma.catalogItem.findMany({
    where,
    take: limit,
    select: { id: true, name: true, price: true, vendor: true, category: true, stock: true },
  })

  await setUserContext(userId, { lastSearch: query })
  return items
}

const getBudgetStatusSchema = z.object({
  departmentId: z.string().optional(),
})

export async function getBudgetStatusHandler(
  params: { departmentId?: string },
  userId: string
): Promise<{ spent: number; total: number; department: string; remaining: number }> {
  const { departmentId } = getBudgetStatusSchema.parse(params)

  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    include: { employees: { where: { email: userId }, select: { id: true } } },
  })

  if (!dept) throw new Error('Department not found')

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const approvedPRs = await prisma.purchaseRequest.aggregate({
    where: {
      departmentId: dept.id,
      status: 'APPROVED',
      approvedAt: { gte: monthStart },
    },
    _sum: { total: true },
  })

  const spent = approvedPRs._sum.total ?? 0
  const total = dept.budget

  return {
    spent,
    total,
    department: dept.name,
    remaining: total - spent,
  }
}

const managePRSchema = z.object({
  action: z.enum(['create', 'add_item', 'remove_item', 'update_quantity', 'delete']),
  prId: z.string().optional(),
  catalogItemId: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
})

export async function managePRHandler(
  params: { action: string; prId?: string; catalogItemId?: string; quantity?: number },
  userId: string
): Promise<PRWithItems> {
  const { action, prId, catalogItemId, quantity } = managePRSchema.parse(params)

  if (action === 'create') {
    const employee = await prisma.user.findUnique({ where: { email: userId } })
    if (!employee) throw new Error('Employee not found')

    const pr = await prisma.purchaseRequest.create({
      data: {
        prNumber: `PR-${Date.now()}`,
        status: 'DRAFT',
        total: 0,
        departmentId: employee.departmentId!,
        requestedBy: employee.email,
      },
    })

    return { ...pr, lineItems: [] }
  }

  if (!prId) throw new Error('PR ID required')

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lineItems: true },
  })

  if (!pr) throw new Error('PR not found')
  if (pr.status !== 'DRAFT') throw new Error('Cannot modify non-draft PR')

  if (action === 'add_item' && catalogItemId) {
    const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } })
    if (!item) throw new Error('Catalog item not found')

    const qty = quantity ?? 1
    const lineItem = await prisma.pRLineItem.create({
      data: {
        purchaseRequestId: pr.id,
        catalogItemId: item.id,
        name: item.name,
        quantity: qty,
        unitPrice: item.price,
        totalPrice: item.price * qty,
      },
    })

    const total = pr.total + lineItem.totalPrice
    await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { total } })

    await setUserContext(userId, { lastAction: 'add_to_pr', lastPRId: pr.id })
    return { ...pr, total, lineItems: [...pr.lineItems, lineItem] }
  }

  if (action === 'remove_item' && catalogItemId) {
    const lineItem = await prisma.pRLineItem.findFirst({
      where: { purchaseRequestId: pr.id, catalogItemId },
    })
    if (!lineItem) throw new Error('Item not found in PR')

    await prisma.pRLineItem.delete({ where: { id: lineItem.id } })

    const total = pr.total - lineItem.totalPrice
    await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { total } })

    await setUserContext(userId, { lastAction: 'remove_from_pr', lastPRId: pr.id })
    return { ...pr, total, lineItems: pr.lineItems.filter(i => i.id !== lineItem.id) }
  }

  return { ...pr, total: pr.total, lineItems: pr.lineItems }
}

const getPRsSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISPUTED']).optional(),
  limit: z.number().min(1).max(100).default(20),
})

export async function getPurchaseRequestsHandler(
  params: { status?: string; limit?: number },
  userId: string
): Promise<PRWithItems[]> {
  const { status, limit } = getPRsSchema.parse(params)

  const where: Record<string, unknown> = {}
  if (status) where.status = status as 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED'

  const prs = await prisma.purchaseRequest.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { lineItems: true },
  })

  return prs.map(pr => ({
    id: pr.id,
    prNumber: pr.prNumber,
    status: pr.status,
    total: pr.total,
    departmentId: pr.departmentId,
    requestedBy: pr.requestedBy,
    lineItems: pr.lineItems.map(li => ({
      catalogItemId: li.catalogItemId,
      name: li.name,
      quantity: li.quantity,
      unitPrice: Number(li.unitPrice),
      totalPrice: Number(li.totalPrice),
    })),
  }))
}

const submitPRSchema = z.object({
  prId: z.string(),
})

export async function submitForApprovalHandler(
  params: { prId: string },
  userId: string
): Promise<PRWithItems> {
  const { prId } = submitPRSchema.parse(params)

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lineItems: true },
  })

  if (!pr) throw new Error('PR not found')
  if (pr.status !== 'DRAFT') throw new Error('Only draft PRs can be submitted')
  if (pr.lineItems.length === 0) throw new Error('PR has no items')

  const updated = await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { status: 'PENDING', submittedAt: new Date() },
  })

  await prisma.pRAuditEntry.create({
    data: {
      purchaseRequestId: prId,
      action: 'SUBMITTED',
      performedBy: userId,
      details: JSON.stringify({ status: 'PENDING' }),
    },
  })

  await setUserContext(userId, { lastAction: 'submit_pr', lastPRId: prId })
  return { ...updated, lineItems: pr.lineItems }
}

const approvalSchema = z.object({
  prId: z.string(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
})

export async function processApprovalHandler(
  params: { prId: string; action: string; reason?: string },
  userId: string
): Promise<{ prId: string; status: string; approvedBy: string }> {
  const { prId, action, reason } = approvalSchema.parse(params)

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } })
  if (!pr) throw new Error('PR not found')
  if (pr.status !== 'PENDING') throw new Error('Only pending PRs can be approved/rejected')

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  const updated = await prisma.purchaseRequest.update({
    where: { id: prId },
    data: {
      status: newStatus,
      approvedBy: userId,
      approvedAt: action === 'approve' ? new Date() : null,
      rejectionReason: action === 'reject' ? reason : null,
    },
  })

  await prisma.pRAuditEntry.create({
    data: {
      purchaseRequestId: prId,
      action: action === 'approve' ? 'APPROVED' : 'REJECTED',
      performedBy: userId,
      details: JSON.stringify({ reason }),
    },
  })

  await setUserContext(userId, { lastAction: action === 'approve' ? 'approve_pr' : 'reject_pr', lastPRId: prId })
  return { prId: updated.id, status: updated.status, approvedBy: userId }
}

const disputeSchema = z.object({
  prId: z.string(),
  reason: z.string().min(10),
})

export async function raiseDisputeHandler(
  params: { prId: string; reason: string },
  userId: string
): Promise<{ prId: string; status: string; reason: string }> {
  const { prId, reason } = disputeSchema.parse(params)

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } })
  if (!pr) throw new Error('PR not found')
  if (pr.status !== 'REJECTED') throw new Error('Can only dispute rejected PRs')

  const updated = await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { status: 'DISPUTED', disputeReason: reason },
  })

  await prisma.pRAuditEntry.create({
    data: {
      purchaseRequestId: prId,
      action: 'DISPUTED',
      performedBy: userId,
      details: JSON.stringify({ reason }),
    },
  })

  await setUserContext(userId, { lastAction: 'raise_dispute', lastPRId: prId })
  return { prId: updated.id, status: updated.status, reason }
}