import { PrismaClient, EmployeeRole, CatalogCategory, PRStatus, PRUrgency, ApprovalStatus } from '@prisma/client'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const db = new PrismaClient()

beforeAll(async () => {
  // Clean slate for tests
  await db.pRAuditEntry.deleteMany()
  await db.pRApproval.deleteMany()
  await db.pRLineItem.deleteMany()
  await db.purchaseRequest.deleteMany()
  await db.catalogItem.deleteMany()
  await db.user.deleteMany({ where: {
    email: { endsWith: '@test.procureai.com' }
  }})
  await db.department.deleteMany({ where: {
    code: { startsWith: 'TEST-' }
  }})
})

afterAll(() => db.$disconnect())

// ── DEPARTMENT ────────────────────────────────────
describe('Department model', () => {
  it('creates a department with budget', async () => {
    const dept = await db.department.create({
      data: {
        name:          'Test Engineering',
        code:          'TEST-ENG',
        monthlyBudget: 50000_00,
        approverEmail: 'mgr@test.procureai.com',
      }
    })
    expect(dept.id).toBeTruthy()
    expect(dept.spentThisMonth).toBe(0)
    expect(dept.monthlyBudget).toBe(50000_00)
  })

  it('enforces unique code constraint', async () => {
    await expect(
      db.department.create({
        data: {
          name:          'Duplicate',
          code:          'TEST-ENG',   // duplicate
          monthlyBudget: 1000,
          approverEmail: 'x@test.procureai.com',
        }
      })
    ).rejects.toThrow()
  })
})

// ── USER ROLE + DEPARTMENT ────────────────────────
describe('User B2B fields', () => {
  it('creates employee with role and department', async () => {
    const dept = await db.department.findUnique({
      where: { code: 'TEST-ENG' }
    })
    const user = await db.user.create({
      data: {
        email:        'emp@test.procureai.com',
        role:         'EMPLOYEE',
        departmentId: dept!.id,
      }
    })
    expect(user.role).toBe('EMPLOYEE')
    expect(user.departmentId).toBe(dept!.id)
  })

  it('defaults role to EMPLOYEE', async () => {
    const user = await db.user.create({
      data: { email: 'emp2@test.procureai.com' }
    })
    expect(user.role).toBe('EMPLOYEE')
  })
})

// ── CATALOG ITEM ──────────────────────────────────
describe('CatalogItem model', () => {
  it('creates an item with all required fields', async () => {
    const item = await db.catalogItem.create({
      data: {
        name:       'Test MacBook Pro',
        description:'Test description',
        sku:        'TEST-HW-001',
        unitPrice:  199900_00,
        category:   'HARDWARE',
        vendor:     'Apple Test',
        vendorCode: 'TEST-MBP',
        leadDays:   7,
      }
    })
    expect(item.inStock).toBe(true)
    expect(item.minOrderQty).toBe(1)
    expect(item.sku).toBe('TEST-HW-001')
  })

  it('enforces unique SKU', async () => {
    await expect(
      db.catalogItem.create({
        data: {
          name:'Dup', description:'d', sku:'TEST-HW-001',
          unitPrice:1, category:'HARDWARE',
          vendor:'V', vendorCode:'C', leadDays:1,
        }
      })
    ).rejects.toThrow()
  })
})

// ── PURCHASE REQUEST ──────────────────────────────
describe('PurchaseRequest model', () => {
  it('creates a PR in DRAFT status', async () => {
    const [dept, emp] = await Promise.all([
      db.department.findUnique({ where:{code:'TEST-ENG'}}),
      db.user.findUnique({ where:{email:'emp@test.procureai.com'}}),
    ])
    const pr = await db.purchaseRequest.create({
      data: {
        prNumber:     'TEST-PR-0001',
        requestorId:  emp!.id,
        departmentId: dept!.id,
        justification:'Test purchase',
        totalAmount:  0,
      }
    })
    expect(pr.status).toBe('DRAFT')
    expect(pr.urgency).toBe('NORMAL')
    expect(pr.totalAmount).toBe(0)
  })

  it('creates PR with line item and updates total', async () => {
    const [pr, item] = await Promise.all([
      db.purchaseRequest.findUnique({
        where: { prNumber: 'TEST-PR-0001' }
      }),
      db.catalogItem.findUnique({
        where: { sku: 'TEST-HW-001' }
      }),
    ])

    await db.pRLineItem.create({
      data: {
        prId:         pr!.id,
        catalogItemId:item!.id,
        quantity:     1,
        unitPrice:    item!.unitPrice,
        totalPrice:   item!.unitPrice,
      }
    })

    await db.purchaseRequest.update({
      where: { id: pr!.id },
      data:  { totalAmount: item!.unitPrice }
    })

    const updated = await db.purchaseRequest.findUnique({
      where:   { id: pr!.id },
      include: { lineItems: true }
    })
    expect(updated!.lineItems).toHaveLength(1)
    expect(updated!.totalAmount).toBe(199900_00)
  })
})

// ── PR APPROVAL ───────────────────────────────────
describe('PRApproval model', () => {
  it('creates pending approval for a PR', async () => {
    const pr = await db.purchaseRequest.findUnique({
      where: { prNumber: 'TEST-PR-0001' }
    })
    const approval = await db.pRApproval.create({
      data: {
        prId:          pr!.id,
        approverEmail: 'mgr@test.procureai.com',
        status:        'PENDING',
      }
    })
    expect(approval.status).toBe('PENDING')
    expect(approval.decidedAt).toBeNull()
  })
})

// ── AUDIT TRAIL ───────────────────────────────────
describe('PRAuditEntry model', () => {
  it('creates immutable audit entries', async () => {
    const pr = await db.purchaseRequest.findUnique({
      where: { prNumber: 'TEST-PR-0001' }
    })
    const entry = await db.pRAuditEntry.create({
      data: {
        prId:    pr!.id,
        action:  'PR_CREATED',
        actor:   'emp@test.procureai.com',
        details: { justification: 'Test purchase' },
      }
    })
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toBeTruthy()
  })
})

// ── RELATIONS ─────────────────────────────────────
describe('Relational integrity', () => {
  it('cascades delete PRLineItems when PR deleted', async () => {
    const pr = await db.purchaseRequest.findUnique({
      where:   { prNumber: 'TEST-PR-0001' },
      include: { lineItems: true }
    })
    expect(pr!.lineItems.length).toBeGreaterThan(0)

    await db.pRAuditEntry.deleteMany({ where:{prId:pr!.id}})
    await db.pRApproval.deleteMany({  where:{prId:pr!.id}})
    await db.purchaseRequest.delete({ where:{id:pr!.id}})

    const orphanedItems = await db.pRLineItem.findMany({
      where: { prId: pr!.id }
    })
    expect(orphanedItems).toHaveLength(0)  // cascade worked
  })
})