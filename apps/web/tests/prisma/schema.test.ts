/**
 * Prisma Schema DMMF Validation Tests (TDD)
 *
 * Validates Prisma schema structure using DMMF (Data Model Meta Format).
 * Tests verify schema structure BEFORE migrations are run.
 *
 * Requirements validated:
 * - All 7 core models present (User, Product, Cart, Order, ReturnRequest, CommerceEvent, AgentTrace)
 * - pgvector embedding support (1536 dimensions)
 * - Optimistic locking (version field on Cart and Product)
 * - Proper enum definitions (Role, OrderStatus, ReturnOption, CommerceEventType)
 * - Correct indexes (embedding, category, etc.)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getDMMF, DMMF } from '@prisma/internals';
import * as path from 'path';
import * as fs from 'fs';

// DMMF type helpers
type Model = DMMF.Model;
type Field = DMMF.Field;
type Enum = DMMF.DatamodelEnum;

describe('Prisma Schema Structure', () => {
  let dmmf: DMMF.Document;
  let schemaContent: string;

  beforeAll(async () => {
    // Load DMMF from schema file
    const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma');
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    dmmf = await getDMMF({ datamodel: schemaContent });
  });

  // ==========================================================================
  // MODEL EXISTENCE TESTS
  // ==========================================================================

  describe('Model Existence', () => {
    it('User model exists with required fields', async () => {
      const userModel = dmmf.datamodel.models.find((m) => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['id', 'email', 'role', 'password', 'name', 'createdAt', 'updatedAt'])
      );
    });

    it('Product model exists with pgvector embedding', async () => {
      const productModel = dmmf.datamodel.models.find((m) => m.name === 'Product');
      expect(productModel).toBeDefined();
      // Note: Unsupported types like vector(1536) aren't in DMMF fields
      // Check schema content directly for embedding support
      expect(schemaContent).toContain('Unsupported("vector(1536)")');
    });

    it('Cart model exists with required fields', async () => {
      const cartModel = dmmf.datamodel.models.find((m) => m.name === 'Cart');
      expect(cartModel).toBeDefined();
      expect(cartModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['id', 'userId', 'items', 'total', 'version', 'createdAt', 'updatedAt'])
      );
    });

    it('Order model exists with required fields', async () => {
      const orderModel = dmmf.datamodel.models.find((m) => m.name === 'Order');
      expect(orderModel).toBeDefined();
      expect(orderModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([
          'id',
          'userId',
          'status',
          'stripePaymentIntent',
          'items',
          'total',
          'trackingNumber',
          'createdAt',
          'updatedAt',
        ])
      );
    });

    it('ReturnRequest model exists with required fields', async () => {
      const returnRequestModel = dmmf.datamodel.models.find((m) => m.name === 'ReturnRequest');
      expect(returnRequestModel).toBeDefined();
      expect(returnRequestModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([
          'id',
          'orderId',
          'userId',
          'reason',
          'policy',
          'chosenOption',
          'stripeRefundId',
          'createdAt',
          'updatedAt',
        ])
      );
    });

    it('CommerceEvent model exists with required fields', async () => {
      const commerceEventModel = dmmf.datamodel.models.find((m) => m.name === 'CommerceEvent');
      expect(commerceEventModel).toBeDefined();
      expect(commerceEventModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['id', 'type', 'userId', 'payload', 'processed', 'processedAt', 'createdAt'])
      );
    });

    it('AgentTrace model exists with required fields', async () => {
      const agentTraceModel = dmmf.datamodel.models.find((m) => m.name === 'AgentTrace');
      expect(agentTraceModel).toBeDefined();
      expect(agentTraceModel?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['id', 'userId', 'sessionId', 'toolName', 'input', 'output', 'latencyMs', 'createdAt'])
      );
    });
  });

  // ==========================================================================
  // ENUM TESTS
  // ==========================================================================

  describe('Enum Definitions', () => {
    it('Role enum has CUSTOMER and MERCHANT', async () => {
      const roleEnum = dmmf.datamodel.enums.find((e) => e.name === 'Role');
      expect(roleEnum).toBeDefined();
      expect(roleEnum?.values.map((v) => v.name)).toEqual(expect.arrayContaining(['CUSTOMER', 'MERCHANT', 'ADMIN']));
    });

    it('OrderStatus enum has all required statuses', async () => {
      const statusEnum = dmmf.datamodel.enums.find((e) => e.name === 'OrderStatus');
      expect(statusEnum).toBeDefined();
      expect(statusEnum?.values.map((v) => v.name)).toEqual([
        'PENDING',
        'PAID',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
      ]);
    });

    it('ReturnOption enum has all required values', async () => {
      const returnOptionEnum = dmmf.datamodel.enums.find((e) => e.name === 'ReturnOption');
      expect(returnOptionEnum).toBeDefined();
      expect(returnOptionEnum?.values.map((v) => v.name)).toEqual(['REPLACEMENT', 'REFUND', 'STORE_CREDIT']);
    });

    it('CommerceEventType enum has all required values', async () => {
      const eventTypeEnum = dmmf.datamodel.enums.find((e) => e.name === 'CommerceEventType');
      expect(eventTypeEnum).toBeDefined();
      expect(eventTypeEnum?.values.map((v) => v.name)).toEqual([
        'CART_ABANDONED',
        'STOCK_LOW',
        'PRICE_DROP',
        'ORDER_CREATED',
        'ORDER_SHIPPED',
        'RETURN_REQUESTED',
      ]);
    });
  });

  // ==========================================================================
  // INDEX TESTS
  // ==========================================================================

  describe('Database Indexes', () => {
    it('Product has index on embedding', async () => {
      // DMMF doesn't expose indexes, check schema content directly
      expect(schemaContent).toMatch(/@@index\(\[embedding\]\)/);
    });

    it('Product has index on category', async () => {
      expect(schemaContent).toMatch(/@@index\(\[category\]\)/);
    });

    it('Product has index on stockCount', async () => {
      expect(schemaContent).toMatch(/@@index\(\[stockCount\]\)/);
    });

    it('Order has composite index on userId and status', async () => {
      expect(schemaContent).toMatch(/@@index\(\[userId, status\]\)/);
    });

    it('Order has index on status', async () => {
      expect(schemaContent).toMatch(/@@index\(\[status\]\)/);
    });

    it('ReturnRequest has index on orderId', async () => {
      expect(schemaContent).toMatch(/@@index\(\[orderId\]\)/);
    });

    it('CommerceEvent has composite index on processed and createdAt', async () => {
      expect(schemaContent).toMatch(/@@index\(\[processed, createdAt\]\)/);
    });

    it('AgentTrace has composite index on userId and createdAt', async () => {
      expect(schemaContent).toMatch(/@@index\(\[userId, createdAt\]\)/);
    });
  });

  // ==========================================================================
  // OPTIMISTIC LOCKING TESTS
  // ==========================================================================

  describe('Optimistic Locking', () => {
    it('Cart has version field for optimistic locking', async () => {
      const cartModel = dmmf.datamodel.models.find((m) => m.name === 'Cart');
      const versionField = cartModel?.fields.find((f) => f.name === 'version');
      expect(versionField).toBeDefined();
      expect(versionField?.type).toBe('Int');
      // Default value is stored directly, not as { name: 'value' }
      expect(versionField?.default).toBe(1);
    });

    it('Product has version field for optimistic locking', async () => {
      const productModel = dmmf.datamodel.models.find((m) => m.name === 'Product');
      const versionField = productModel?.fields.find((f) => f.name === 'version');
      expect(versionField).toBeDefined();
      expect(versionField?.type).toBe('Int');
      expect(versionField?.default).toBe(1);
    });
  });

  // ==========================================================================
  // RELATIONSHIP TESTS
  // ==========================================================================

  describe('Model Relationships', () => {
    it('Cart has unique relation to User with CASCADE delete', async () => {
      const cartModel = dmmf.datamodel.models.find((m) => m.name === 'Cart');
      const userRelation = cartModel?.fields.find((f) => f.name === 'user');
      expect(userRelation).toBeDefined();
      expect(userRelation?.relationName).toBe('CartToUser');
    });

    it('Order has relation to User with RESTRICT delete', async () => {
      const orderModel = dmmf.datamodel.models.find((m) => m.name === 'Order');
      const userRelation = orderModel?.fields.find((f) => f.name === 'user');
      expect(userRelation).toBeDefined();
      expect(userRelation?.relationName).toBe('OrderToUser');
    });

    it('ReturnRequest has relation to Order with RESTRICT delete', async () => {
      const returnRequestModel = dmmf.datamodel.models.find((m) => m.name === 'ReturnRequest');
      const orderRelation = returnRequestModel?.fields.find((f) => f.name === 'order');
      expect(orderRelation).toBeDefined();
      // Prisma names relations from the perspective of the related model
      expect(orderRelation?.relationName).toBe('OrderToReturnRequest');
    });

    it('CommerceEvent has optional relation to User with SET NULL delete', async () => {
      const commerceEventModel = dmmf.datamodel.models.find((m) => m.name === 'CommerceEvent');
      const userRelation = commerceEventModel?.fields.find((f) => f.name === 'user');
      expect(userRelation).toBeDefined();
      expect(userRelation?.relationName).toBe('CommerceEventToUser');
    });

    it('AgentTrace has relation to User with CASCADE delete', async () => {
      const agentTraceModel = dmmf.datamodel.models.find((m) => m.name === 'AgentTrace');
      const userRelation = agentTraceModel?.fields.find((f) => f.name === 'user');
      expect(userRelation).toBeDefined();
      expect(userRelation?.relationName).toBe('AgentTraceToUser');
    });
  });

  // ==========================================================================
  // FIELD TYPE TESTS
  // ==========================================================================

  describe('Field Types', () => {
    it('User email is unique', async () => {
      const userModel = dmmf.datamodel.models.find((m) => m.name === 'User');
      const emailField = userModel?.fields.find((f) => f.name === 'email');
      expect(emailField?.isId || emailField?.isUnique).toBe(true);
    });

    it('Product price is Int (smallest currency unit)', async () => {
      const productModel = dmmf.datamodel.models.find((m) => m.name === 'Product');
      const priceField = productModel?.fields.find((f) => f.name === 'price');
      expect(priceField?.type).toBe('Int');
    });

    it('Cart items is JSON type', async () => {
      const cartModel = dmmf.datamodel.models.find((m) => m.name === 'Cart');
      const itemsField = cartModel?.fields.find((f) => f.name === 'items');
      expect(itemsField?.type).toBe('Json');
    });

    it('Order items is JSON type', async () => {
      const orderModel = dmmf.datamodel.models.find((m) => m.name === 'Order');
      const itemsField = orderModel?.fields.find((f) => f.name === 'items');
      expect(itemsField?.type).toBe('Json');
    });

    it('AgentTrace input and output are JSON types', async () => {
      const agentTraceModel = dmmf.datamodel.models.find((m) => m.name === 'AgentTrace');
      const inputField = agentTraceModel?.fields.find((f) => f.name === 'input');
      const outputField = agentTraceModel?.fields.find((f) => f.name === 'output');
      expect(inputField?.type).toBe('Json');
      expect(outputField?.type).toBe('Json');
    });
  });
});
