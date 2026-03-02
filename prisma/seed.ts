/**
 * Database Seed Script
 * Seeds 20 realistic products for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'MacBook Pro 16"',
    description: 'High-performance laptop with M3 Pro chip, 18GB RAM, 512GB SSD',
    price: 2499.99,
    stock: 15,
    category: 'Laptops',
    sku: 'MBP-16-M3-512',
    brand: 'Apple',
    rating: 4.9,
  },
  {
    name: 'Dell XPS 15',
    description: 'Premium laptop with Intel i9, 32GB RAM, 1TB SSD, OLED display',
    price: 2299.99,
    stock: 10,
    category: 'Laptops',
    sku: 'XPS-15-I9-1TB',
    brand: 'Dell',
    rating: 4.7,
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Industry-leading noise canceling wireless headphones',
    price: 399.99,
    stock: 50,
    category: 'Audio',
    sku: 'SONY-WH1000XM5-B',
    brand: 'Sony',
    rating: 4.8,
  },
  {
    name: 'Bose QuietComfort 45',
    description: 'Wireless noise cancelling headphones with 24-hour battery',
    price: 329.99,
    stock: 35,
    category: 'Audio',
    sku: 'BOSE-QC45-B',
    brand: 'Bose',
    rating: 4.6,
  },
  {
    name: 'iPhone 15 Pro Max',
    description: '256GB, Titanium finish with A17 Pro chip',
    price: 1199.99,
    stock: 25,
    category: 'Smartphones',
    sku: 'IP15PM-256-TI',
    brand: 'Apple',
    rating: 4.9,
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: '512GB, Titanium with S Pen and AI features',
    price: 1299.99,
    stock: 20,
    category: 'Smartphones',
    sku: 'GS24U-512-TI',
    brand: 'Samsung',
    rating: 4.8,
  },
  {
    name: 'iPad Pro 12.9"',
    description: 'M2 chip, 256GB, WiFi + Cellular',
    price: 1099.99,
    stock: 18,
    category: 'Tablets',
    sku: 'IPP-129-M2-256',
    brand: 'Apple',
    rating: 4.8,
  },
  {
    name: 'Samsung Galaxy Tab S9',
    description: '11" AMOLED display, 256GB, includes S Pen',
    price: 799.99,
    stock: 22,
    category: 'Tablets',
    sku: 'GTS9-256-GR',
    brand: 'Samsung',
    rating: 4.6,
  },
  {
    name: 'AirPods Pro (2nd Gen)',
    description: 'Active noise cancellation with MagSafe charging',
    price: 249.99,
    stock: 100,
    category: 'Audio',
    sku: 'APP-2GEN-MAG',
    brand: 'Apple',
    rating: 4.7,
  },
  {
    name: 'LG C3 65" OLED TV',
    description: '4K Smart OLED TV with AI Picture Pro and webOS',
    price: 1799.99,
    stock: 8,
    category: 'TVs',
    sku: 'LG-C3-65-OLED',
    brand: 'LG',
    rating: 4.9,
  },
  {
    name: 'PlayStation 5',
    description: 'Console with DualSense controller, 825GB SSD',
    price: 499.99,
    stock: 30,
    category: 'Gaming',
    sku: 'PS5-STD-825',
    brand: 'Sony',
    rating: 4.9,
  },
  {
    name: 'Xbox Series X',
    description: '1TB SSD console with 4K gaming at 120fps',
    price: 499.99,
    stock: 25,
    category: 'Gaming',
    sku: 'XSX-1TB-BLK',
    brand: 'Microsoft',
    rating: 4.8,
  },
  {
    name: 'Canon EOS R6 Mark II',
    description: 'Full-frame mirrorless camera with 24.2MP sensor',
    price: 2499.99,
    stock: 5,
    category: 'Cameras',
    sku: 'CAN-R6M2-BODY',
    brand: 'Canon',
    rating: 4.8,
  },
  {
    name: 'Sony A7 IV',
    description: '33MP full-frame mirrorless camera with 4K 60p video',
    price: 2498.99,
    stock: 7,
    category: 'Cameras',
    sku: 'SNY-A7IV-33MP',
    brand: 'Sony',
    rating: 4.9,
  },
  {
    name: 'Logitech MX Master 3S',
    description: 'Wireless performance mouse with 8K DPI sensor',
    price: 99.99,
    stock: 75,
    category: 'Accessories',
    sku: 'LOG-MXM3S-GR',
    brand: 'Logitech',
    rating: 4.7,
  },
  {
    name: 'Keychron K2 Mechanical Keyboard',
    description: 'Wireless mechanical keyboard with Gateron switches',
    price: 89.99,
    stock: 40,
    category: 'Accessories',
    sku: 'KEY-K2-RGB',
    brand: 'Keychron',
    rating: 4.6,
  },
  {
    name: 'Samsung 990 PRO 2TB SSD',
    description: 'PCIe 4.0 NVMe M.2 SSD with 7450 MB/s read speed',
    price: 169.99,
    stock: 60,
    category: 'Storage',
    sku: 'SAM-990PRO-2TB',
    brand: 'Samsung',
    rating: 4.9,
  },
  {
    name: 'WD Black 4TB HDD',
    description: 'High-performance desktop hard drive, 7200 RPM',
    price: 109.99,
    stock: 45,
    category: 'Storage',
    sku: 'WD-BLK-4TB-72',
    brand: 'Western Digital',
    rating: 4.5,
  },
  {
    name: 'Anker PowerCore 26800mAh',
    description: 'Portable charger with 3 USB ports and fast charging',
    price: 65.99,
    stock: 120,
    category: 'Accessories',
    sku: 'ANK-PC268-BLK',
    brand: 'Anker',
    rating: 4.7,
  },
  {
    name: 'Fitbit Charge 6',
    description: 'Advanced fitness tracker with GPS and heart rate monitoring',
    price: 159.99,
    stock: 55,
    category: 'Wearables',
    sku: 'FIT-CH6-BLK',
    brand: 'Fitbit',
    rating: 4.5,
  },
];

async function main() {
  console.log('Start seeding...');

  // Clear existing data in correct order (foreign keys)
  await prisma.order.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  console.log('Cleared existing data');

  // Insert products
  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
    console.log(`Created: ${product.name}`);
  }

  const count = await prisma.product.count();
  console.log(`\nSeeding completed. Total products: ${count}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
