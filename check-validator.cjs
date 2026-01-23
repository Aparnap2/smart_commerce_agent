const { mapProductToSchema } = require('./lib/schemas/mapper');
const { validator } = require('./lib/schemas/validator');

const validProductFixture = {
  id: 'prod-123',
  sku: 'SKU-001',
  name: 'Test Product',
  description: 'A test product description',
  imageUrl: 'https://example.com/product.jpg',
  brand: 'TestBrand',
  price: 99.99,
  compareAtPrice: 129.99,
  costPrice: 50.00,
  currency: 'USD',
  inventory: 100,
  availability: 'IN_STOCK',
  category: 'Electronics',
  tags: ['tag1', 'tag2'],
  weight: 1.5,
  length: 20,
  width: 15,
  height: 10,
  rating: 4.5,
  reviewCount: 150,
  gtin: '1234567890123',
  mpn: 'MPN-001',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

const product = mapProductToSchema(validProductFixture);
console.log('Mapped product:', JSON.stringify(product, null, 2));

const result = validator.validateProduct(product);
console.log('Validation result:', JSON.stringify(result, null, 2));
