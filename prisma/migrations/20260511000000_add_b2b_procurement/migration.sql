-- B2B Procurement Tables for Smart Commerce
-- Adds Department, PurchaseRequest, PRLineItem, CatalogItem, PRApproval, PRAuditEntry

-- Create enums if not exist
DO $$ BEGIN
    CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'DISPUTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PRUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELEGATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CatalogCategory" AS ENUM ('HARDWARE', 'SOFTWARE', 'SERVICES', 'OFFICE_SUPPLIES', 'INFRASTRUCTURE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EmployeeRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add B2B columns to existing users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employeeRole" "EmployeeRole" DEFAULT 'EMPLOYEE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

-- Department table
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "code" TEXT NOT NULL UNIQUE,
    "monthlyBudget" INTEGER NOT NULL DEFAULT 0,
    "spentThisMonth" INTEGER NOT NULL DEFAULT 0,
    "approverEmail" TEXT NOT NULL,
    "headEmail" TEXT,
    "financeEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PurchaseRequest table
CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" TEXT NOT NULL UNIQUE,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "justification" TEXT NOT NULL,
    "urgency" "PRUrgency" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "requestorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvalThreadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseRequest_requestorId_fkey" FOREIGN KEY ("requestorId") REFERENCES "users"("id"),
    CONSTRAINT "PurchaseRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
);

-- CatalogItem table
CREATE TABLE IF NOT EXISTS "CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT NOT NULL UNIQUE,
    "unitPrice" INTEGER NOT NULL,
    "category" "CatalogCategory" NOT NULL,
    "vendor" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 3,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "vendorApproved" BOOLEAN NOT NULL DEFAULT true,
    "msaExpiryDate" TIMESTAMP(3),
    "vendorRating" INTEGER,
    "searchVector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PRLineItem table
CREATE TABLE IF NOT EXISTS "PRLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 18,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalWithTax" INTEGER NOT NULL DEFAULT 0,
    "prId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    CONSTRAINT "PRLineItem_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE,
    CONSTRAINT "PRLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id"),
    UNIQUE("prId", "catalogItemId")
);

-- PRApproval table
CREATE TABLE IF NOT EXISTS "PRApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverEmail" TEXT NOT NULL,
    "approverName" TEXT,
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "prId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PRApproval_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id")
);

-- PRAuditEntry table
CREATE TABLE IF NOT EXISTS "PRAuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "prId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PRAuditEntry_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PurchaseRequest_requestorId_idx" ON "PurchaseRequest"("requestorId");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_departmentId_idx" ON "PurchaseRequest"("departmentId");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");
CREATE INDEX IF NOT EXISTS "PRLineItem_prId_idx" ON "PRLineItem"("prId");
CREATE INDEX IF NOT EXISTS "PRApproval_prId_idx" ON "PRApproval"("prId");
CREATE INDEX IF NOT EXISTS "PRAuditEntry_prId_idx" ON "PRAuditEntry"("prId");
CREATE INDEX IF NOT EXISTS "CatalogItem_category_idx" ON "CatalogItem"("category");

-- Seed data
INSERT INTO "Department" ("id", "name", "code", "monthlyBudget", "spentThisMonth", "approverEmail")
VALUES 
    ('dept-eng-001', 'Engineering', 'ENG', 50000000, 0, 'manager@techtrend.com'),
    ('dept-sales-001', 'Sales', 'SALES', 30000000, 0, 'sales-manager@techtrend.com'),
    ('dept-ops-001', 'Operations', 'OPS', 20000000, 0, 'ops-manager@techtrend.com')
ON CONFLICT DO NOTHING;

-- Seed catalog items
INSERT INTO "CatalogItem" ("id", "name", "description", "sku", "unitPrice", "category", "vendor", "vendorCode", "leadDays", "inStock", "minOrderQty")
VALUES 
    ('cat-laptop-001', 'MacBook Pro 14"', 'Apple MacBook Pro with M3 chip, 16GB RAM, 512GB SSD', 'MBP-14-M3', 21990000, 'HARDWARE', 'Apple Inc', 'APPLE-001', 7, true, 1),
    ('cat-laptop-002', 'Dell XPS 15', 'Dell XPS 15 Laptop, Intel i7, 16GB RAM, 512GB SSD', 'DELL-XPS15', 15990000, 'HARDWARE', 'Dell Technologies', 'DELL-002', 5, true, 1),
    ('cat-monitor-001', 'Dell UltraSharp 27"', '27" 4K USB-C Hub Monitor', 'DELL-U2722D', 5499000, 'HARDWARE', 'Dell Technologies', 'DELL-003', 3, true, 1),
    ('cat-keyboard-001', 'Logitech MX Keys', 'Advanced Wireless Illuminated Keyboard', 'LOGI-MXKEYS', 119900, 'HARDWARE', 'Logitech', 'LOGI-001', 2, true, 5),
    ('cat-software-001', 'Slack Business+', 'Annual subscription for Business+ tier', 'SLACK-BP', 1999000, 'SOFTWARE', 'Salesforce', 'SLACK-001', 1, true, 10),
    ('cat-software-002', 'GitHub Enterprise', 'Annual GitHub Enterprise license', 'GITHUB-ENT', 2999000, 'SOFTWARE', 'GitHub', 'GITHUB-002', 1, true, 10),
    ('cat-office-001', 'HP LaserJet Printer', 'HP LaserJet Pro MFP4101dn', 'HP-LJ4101', 849900, 'OFFICE_SUPPLIES', 'HP Inc', 'HP-001', 3, true, 1),
    ('cat-service-001', 'AWS Support Business', 'Annual AWS Support Business plan', 'AWS-SUP-BIZ', 49990000, 'SERVICES', 'Amazon Web Services', 'AWS-001', 1, true, 1)
ON CONFLICT DO NOTHING;
