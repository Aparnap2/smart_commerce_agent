/**
 * B2B Procurement Seed Script
 * Seeds departments, employees, and catalog items for ProcureAI
 */

import { PrismaClient, EmployeeRole, CatalogCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Departments
  const eng = await db.department.upsert({
    where: { code: 'ENG' },
    create: {
      name: 'Engineering',
      code: 'ENG',
      monthlyBudget: 50000_00,
      approverEmail: 'manager@acme.com',
    },
    update: {},
  })

  const mktg = await db.department.upsert({
    where: { code: 'MKTG' },
    create: {
      name: 'Marketing',
      code: 'MKTG',
      monthlyBudget: 25000_00,
      approverEmail: 'manager@acme.com',
    },
    update: {},
  })

  // Create OPS department for testing
  const ops = await db.department.upsert({
    where: { code: 'OPS' },
    create: {
      name: 'Operations',
      code: 'OPS',
      monthlyBudget: 15000_00,
      approverEmail: 'manager@acme.com',
    },
    update: {},
  })

  // Users
  const hash = await bcrypt.hash('password123', 10)

  await db.user.upsert({
    where: { email: 'employee@acme.com' },
    create: {
      email: 'employee@acme.com',
      name: 'Priya Sharma',
      passwordHash: hash,
      employeeRole: EmployeeRole.EMPLOYEE,
      departmentId: eng.id,
    },
    update: {},
  })

  await db.user.upsert({
    where: { email: 'manager@acme.com' },
    create: {
      email: 'manager@acme.com',
      name: 'Rahul Mehta',
      passwordHash: hash,
      employeeRole: EmployeeRole.MANAGER,
      departmentId: eng.id,
    },
    update: {},
  })

  await db.user.upsert({
    where: { email: 'finance@acme.com' },
    create: {
      email: 'finance@acme.com',
      name: 'Anita Gupta',
      passwordHash: hash,
      employeeRole: EmployeeRole.FINANCE,
      departmentId: eng.id,
    },
    update: {},
  })

  // Catalog items
  const items = [
    {
      name: 'MacBook Pro M4 14"',
      description: 'Apple M4 Pro chip, 24GB RAM, 512GB SSD',
      sku: 'HW-APPLE-MBP14-M4',
      unitPrice: 199900_00,
      category: CatalogCategory.HARDWARE,
      vendor: 'Apple India Pvt Ltd',
      vendorCode: 'Z14A-MBP-M4-24-512',
      leadDays: 7,
    },
    {
      name: 'Dell UltraSharp 27" 4K Monitor',
      description: 'U2723D, USB-C 90W, IPS Black',
      sku: 'HW-DELL-U2723D',
      unitPrice: 52000_00,
      category: CatalogCategory.HARDWARE,
      vendor: 'Dell India Pvt Ltd',
      vendorCode: 'U2723D',
      leadDays: 5,
    },
    {
      name: 'GitHub Enterprise (per seat/year)',
      description: 'GitHub Enterprise Cloud, 1 user licence',
      sku: 'SW-GH-ENT-SEAT',
      unitPrice: 18000_00,
      category: CatalogCategory.SOFTWARE,
      vendor: 'GitHub Inc.',
      vendorCode: 'GHE-CLOUD-SEAT',
      leadDays: 1,
    },
    {
      name: 'Figma Professional (per seat/year)',
      description: 'Figma Professional plan, 1 user',
      sku: 'SW-FIGMA-PRO-SEAT',
      unitPrice: 4500_00,
      category: CatalogCategory.SOFTWARE,
      vendor: 'Figma Inc.',
      vendorCode: 'FIG-PRO-ANNUAL',
      leadDays: 1,
    },
    {
      name: 'AWS Business Support (per month)',
      description: 'AWS Business Support Plan, monthly',
      sku: 'SVC-AWS-BIZ-MO',
      unitPrice: 15000_00,
      category: CatalogCategory.INFRASTRUCTURE,
      vendor: 'Amazon Web Services',
      vendorCode: 'SUPP-BIZ-MO',
      leadDays: 1,
    },
    {
      name: 'Herman Miller Aeron Chair',
      description: 'Size B, Graphite, fully adjustable',
      sku: 'OFC-HM-AERON-B',
      unitPrice: 95000_00,
      category: CatalogCategory.OFFICE_SUPPLIES,
      vendor: 'Herman Miller India',
      vendorCode: 'AERON-B-GRP',
      leadDays: 14,
    },
    {
      name: 'Notion Team (per seat/year)',
      description: 'Notion Team plan, 1 user',
      sku: 'SW-NOTION-TEAM-SEAT',
      unitPrice: 2000_00,
      category: CatalogCategory.SOFTWARE,
      vendor: 'Notion Labs Inc.',
      vendorCode: 'NOTION-TEAM-ANNUAL',
      leadDays: 1,
    },
  ]

  for (const item of items) {
    await db.catalogItem.upsert({
      where: { sku: item.sku },
      create: item,
      update: item,
    })
  }

  console.log('✅ B2B seed complete')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())