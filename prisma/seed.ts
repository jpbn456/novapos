import { PrismaClient, UserRole, PaymentMethod } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { getPgPoolConfig } from '../src/lib/prisma-config'

const prisma = new PrismaClient({
  adapter: new PrismaPg(new pg.Pool(getPgPoolConfig(true))),
})

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@retailpos.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@retailpos.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  })
  console.log(`✅ Created admin: ${admin.email}`)

  // Create manager
  const managerPassword = await bcrypt.hash('manager123', 10)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@retailpos.com' },
    update: {},
    create: {
      name: 'Manager',
      email: 'manager@retailpos.com',
      password: managerPassword,
      role: UserRole.MANAGER,
    },
  })
  console.log(`✅ Created manager: ${manager.email}`)

  // Create locations
  const locations = await Promise.all([
    prisma.location.upsert({
      where: { id: 'loc-central' },
      update: {},
      create: {
        id: 'loc-central',
        name: 'Sucursal Central',
        address: 'Av. Principal 1234',
        phone: '11-1234-5678',
      },
    }),
    prisma.location.upsert({
      where: { id: 'loc-norte' },
      update: {},
      create: {
        id: 'loc-norte',
        name: 'Sucursal Norte',
        address: 'Av. Norte 567',
        phone: '11-5678-1234',
      },
    }),
    prisma.location.upsert({
      where: { id: 'loc-sur' },
      update: {},
      create: {
        id: 'loc-sur',
        name: 'Sucursal Sur',
        address: 'Av. Sur 890',
        phone: '11-9012-3456',
      },
    }),
  ])
  console.log(`✅ Created ${locations.length} locations`)

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'bebidas' },
      update: {},
      create: { name: 'Bebidas', slug: 'bebidas' },
    }),
    prisma.category.upsert({
      where: { slug: 'alimentos' },
      update: {},
      create: { name: 'Alimentos', slug: 'alimentos' },
    }),
    prisma.category.upsert({
      where: { slug: 'limpieza' },
      update: {},
      create: { name: 'Limpieza', slug: 'limpieza' },
    }),
    prisma.category.upsert({
      where: { slug: 'perfumeria' },
      update: {},
      create: { name: 'Perfumería', slug: 'perfumeria' },
    }),
  ])
  console.log(`✅ Created ${categories.length} categories`)

  // Create suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { email: 'distribuidora@supplier.com' },
      update: {},
      create: {
        name: 'Distribuidora ABC',
        email: 'distribuidora@supplier.com',
        phone: '11-2222-3333',
        address: 'Calle Proveedor 456',
        contact: 'Juan Pérez',
      },
    }),
    prisma.supplier.upsert({
      where: { email: 'mayorista@supplier.com' },
      update: {},
      create: {
        name: 'Mayorista XYZ',
        email: 'mayorista@supplier.com',
        phone: '11-4444-5555',
        address: 'Avenida Mayoreo 789',
        contact: 'María López',
      },
    }),
  ])
  console.log(`✅ Created ${suppliers.length} suppliers`)

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { slug: 'agua-mineral-1.5l' },
      update: {},
      create: {
        name: 'Agua Mineral 1.5L',
        slug: 'agua-mineral-1.5l',
        sku: 'AGUA15',
        barcode: '1234567890001',
        price: 150.00,
        cost: 95.00,
        categoryId: categories[0].id,
        supplierId: suppliers[0].id,
        lowStockThreshold: 20,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'gaseosa-coca-cola-2l' },
      update: {},
      create: {
        name: 'Gaseosa Coca-Cola 2L',
        slug: 'gaseosa-coca-cola-2l',
        sku: 'COCA2L',
        barcode: '1234567890002',
        price: 350.00,
        cost: 220.00,
        categoryId: categories[0].id,
        supplierId: suppliers[0].id,
        lowStockThreshold: 15,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'pan-blanco' },
      update: {},
      create: {
        name: 'Pan Blanco',
        slug: 'pan-blanco',
        sku: 'PANBL',
        barcode: '1234567890003',
        price: 180.00,
        cost: 95.00,
        categoryId: categories[1].id,
        lowStockThreshold: 10,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'detergente-lavandin-1l' },
      update: {},
      create: {
        name: 'Detergente Lavandín 1L',
        slug: 'detergente-lavandin-1l',
        sku: 'DET1L',
        barcode: '1234567890004',
        price: 280.00,
        cost: 165.00,
        categoryId: categories[2].id,
        supplierId: suppliers[1].id,
        lowStockThreshold: 25,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'shampoo-anticaspa-400ml' },
      update: {},
      create: {
        name: 'Shampoo Anticaspa 400ml',
        slug: 'shampoo-anticaspa-400ml',
        sku: 'SHAM400',
        barcode: '1234567890005',
        price: 890.00,
        cost: 520.00,
        categoryId: categories[3].id,
        supplierId: suppliers[1].id,
        lowStockThreshold: 8,
      },
    }),
  ])
  console.log(`✅ Created ${products.length} products`)

  // Create inventory for each product at each location
  const inventoryItems = []
  for (const location of locations) {
    for (const product of products) {
      inventoryItems.push(
        prisma.inventory.upsert({
          where: {
            productId_locationId: {
              productId: product.id,
              locationId: location.id,
            },
          },
          update: {},
          create: {
            productId: product.id,
            locationId: location.id,
            quantity: Math.floor(Math.random() * 100) + 10,
          },
        })
      )
    }
  }
  await Promise.all(inventoryItems)
  console.log(`✅ Created ${inventoryItems.length} inventory items`)

  // Create some sample sales
  const sales = await Promise.all([
    prisma.sale.create({
      data: {
        userId: admin.id,
        locationId: locations[0].id,
        subtotal: 500.00,
        tax: 50.00,
        total: 550.00,
        paymentMethod: PaymentMethod.CASH,
        items: {
          create: [
            { productId: products[0].id, quantity: 2, unitPrice: 150.00, subtotal: 300.00 },
            { productId: products[1].id, quantity: 1, unitPrice: 350.00, subtotal: 350.00 },
          ],
        },
      },
    }),
    prisma.sale.create({
      data: {
        userId: manager.id,
        locationId: locations[1].id,
        subtotal: 450.00,
        tax: 45.00,
        total: 495.00,
        paymentMethod: PaymentMethod.CARD,
        items: {
          create: [
            { productId: products[2].id, quantity: 3, unitPrice: 180.00, subtotal: 540.00 },
          ],
        },
      },
    }),
  ])
  console.log(`✅ Created ${sales.length} sample sales`)

  console.log('\n🎉 Seed completed!')
  console.log('\n📧 Login credentials:')
  console.log('   Admin:   admin@retailpos.com / admin123')
  console.log('   Manager: manager@retailpos.com / manager123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
