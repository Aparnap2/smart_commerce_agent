import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // --- Users ---
  const hashedPassword1 = await bcrypt.hash('password123', 10);
  const user1 = await prisma.user.upsert({
    where: { email: 'user@techtrend.com' },
    update: {},
    create: {
      email: 'user@techtrend.com',
      name: 'Test User',
      password: hashedPassword1,
      role: 'user',
    },
  });

  const hashedPassword2 = await bcrypt.hash('admin456', 10);
  const user2 = await prisma.user.upsert({
    where: { email: 'admin@techtrend.com' },
    update: {},
    create: {
      email: 'admin@techtrend.com',
      name: 'Admin User',
      password: hashedPassword2,
      role: 'admin',
    },
  });

  console.log('Created users:', { user1, user2 });

  // --- Customers ---
  const alice = await prisma.customer.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Smith',
      phone: '123-456-7890',
      address: '123 Main St, Anytown USA',
    },
  });

  const bob = await prisma.customer.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Johnson',
      phone: '987-654-3210',
      address: '456 Oak Ave, Otherville USA',
    },
  });

  const charlie = await prisma.customer.upsert({
    where: { email: 'charlie@sample.net' },
    update: {},
    create: {
      email: 'charlie@sample.net',
      name: 'Charlie Brown',
      phone: '555-123-4567',
      address: '789 Pine Ln, Somewhere USA',
    },
  });

  const diana = await prisma.customer.upsert({
    where: { email: 'diana@test.org' },
    update: {},
    create: {
      email: 'diana@test.org',
      name: 'Diana Prince',
      phone: '555-987-6543',
      address: '1 Wonder Way, Themyscira',
    },
  });

  console.log('Created customers:', { alice, bob, charlie, diana });

  // --- Products (Seed these BEFORE Orders) ---
  const product1 = await prisma.product.upsert({
    where: { id: 101 }, // Use IDs that you will reference in Orders
    update: {},
    create: {
      id: 101,
      name: 'Smartphone X',
      description: 'Latest generation smartphone',
      price: 699.99,
      stock: 50,
      // Add other required fields for your Product model
    },
  });

  const product2 = await prisma.product.upsert({
    where: { id: 102 },
    update: {},
    create: {
      id: 102,
      name: 'Laptop Pro',
      description: 'High-performance laptop for professionals',
      price: 1299.99,
      stock: 25,
      // Add other required fields
    },
  });

  const product3 = await prisma.product.upsert({
    where: { id: 103 },
    update: {},
    create: {
      id: 103,
      name: 'Wireless Earbuds',
      description: 'Noise-cancelling wireless earbuds',
      price: 149.99,
      stock: 100,
      // Add other required fields
    },
  });

  const product4 = await prisma.product.upsert({
    where: { id: 104 },
    update: {},
    create: {
      id: 104,
      name: 'USB-C Charger',
      description: 'Fast charging wall adapter',
      price: 29.99, // Example price
      stock: 200,
      // Add other required fields
    },
  });

  console.log('Created products:', { product1, product2, product3, product4 });

  // --- Orders (Now use the created product IDs) ---
  const order1 = await prisma.order.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      customerId: alice.id,
      productId: product1.id, // Use actual product ID
      total: 699.99,
      status: 'Shipped',
    },
  });

  const order2 = await prisma.order.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      customerId: bob.id,
      productId: product2.id, // Use actual product ID
      total: 1299.99,
      status: 'Processing',
    },
  });

  const order3 = await prisma.order.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      customerId: alice.id,
      productId: product3.id, // Use actual product ID
      total: 149.99,
      status: 'Delivered',
    },
  });

  const order4 = await prisma.order.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      customerId: charlie.id,
      productId: product1.id, // Use actual product ID
      total: 699.99,
      status: 'Pending',
    },
  });

  const order5 = await prisma.order.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      customerId: diana.id,
      productId: product4.id, // Use actual product ID (updated from 104)
      total: 29.99, // Should match product price, adjust if needed
      status: 'Shipped',
    },
  });

  console.log('Created orders:', { order1, order2, order3, order4, order5 });

  // --- Support Tickets ---
  const ticket1 = await prisma.supportTicket.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      customerId: bob.id,
      issue: 'Laptop screen flickering after update.',
      status: 'Open',
    },
  });

  const ticket2 = await prisma.supportTicket.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      customerId: alice.id,
      issue: 'Wrong item delivered for order #3.',
      status: 'Resolved',
    },
  });

  const ticket3 = await prisma.supportTicket.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      customerId: diana.id,
      issue: 'Cannot connect wireless earbuds to phone.',
      status: 'In Progress',
    },
  });

  const ticket4 = await prisma.supportTicket.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      customerId: charlie.id,
      issue: 'Inquiry about return policy for order #4.',
      status: 'Open',
    },
  });

  console.log('Created support tickets:', { ticket1, ticket2, ticket3, ticket4 });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });