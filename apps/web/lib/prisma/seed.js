import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const hashedPassword = await bcrypt.hash('password123', 12);
  
  // --- Users ---
  await prisma.user.upsert({
    where: { email: 'shopper@example.com' },
    update: {},
    create: {
      email: 'shopper@example.com',
      name: 'Shopper User',
      passwordHash: hashedPassword,
      role: 'SHOPPER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'merchant@example.com' },
    update: {},
    create: {
      email: 'merchant@example.com',
      name: 'Merchant User',
      passwordHash: hashedPassword,
      role: 'MERCHANT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'support@example.com' },
    update: {},
    create: {
      email: 'support@example.com',
      name: 'Support Agent',
      passwordHash: hashedPassword,
      role: 'SUPPORT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('Created users');

  // --- Products ---
  const products = [
    { id: 'prod_1', name: 'Wireless Headphones', description: 'Premium noise-cancelling headphones', price: 11990, category: 'Electronics', stockCount: 50 },
    { id: 'prod_2', name: 'Smartphone X', description: 'Latest generation smartphone', price: 69990, category: 'Electronics', stockCount: 30 },
    { id: 'prod_3', name: 'Laptop Pro', description: '15-inch professional laptop', price: 89990, category: 'Electronics', stockCount: 20 },
    { id: 'prod_4', name: 'Smart Watch', description: 'Fitness tracking smartwatch', price: 4990, category: 'Electronics', stockCount: 100 },
    { id: 'prod_5', name: 'Bluetooth Speaker', description: 'Portable waterproof speaker', price: 2990, category: 'Electronics', stockCount: 75 },
    { id: 'prod_6', name: 'Tablet Mini', description: '8-inch tablet for travel', price: 19990, category: 'Electronics', stockCount: 40 },
    { id: 'prod_7', name: 'Gaming Mouse', description: 'RGB gaming mouse with programmable buttons', price: 1990, category: 'Electronics', stockCount: 150 },
    { id: 'prod_8', name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard', price: 5990, category: 'Electronics', stockCount: 60 },
    { id: 'prod_9', name: 'USB-C Hub', description: '7-in-1 USB-C hub', price: 2490, category: 'Electronics', stockCount: 80 },
    { id: 'prod_10', name: 'Webcam HD', description: '1080p webcam for video calls', price: 3990, category: 'Electronics', stockCount: 45 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }

  console.log('Created products:', products.length);

  // --- Verify data ---
  const userCount = await prisma.user.count();
  const productCount = await prisma.product.count();
  
  console.log(`Seed complete: ${userCount} users, ${productCount} products`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
