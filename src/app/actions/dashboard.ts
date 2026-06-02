"use server"

import { prisma } from "@/lib/prisma"
import { DashboardMetrics } from "@/types/auth"

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Today's sales
  const todaySales = await prisma.sale.aggregate({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
      status: "COMPLETED",
    },
    _sum: {
      total: true,
    },
    _count: true,
  })

  // Low stock products - use raw query
  const lowStockRaw = await prisma.$queryRaw<{ count: BigInt }[]>`
    SELECT COUNT(DISTINCT p.id)::int as count
    FROM "Product" p
    JOIN "Inventory" i ON p.id = i."productId"
    WHERE p."isActive" = true
    AND i.quantity < p."lowStockThreshold"
  `
  const lowStockCount = Number(lowStockRaw[0]?.count || 0)

  // Pending transfers
  const pendingTransfers = await prisma.transfer.count({
    where: {
      status: "PENDING",
    },
  })

  // Top products (by quantity sold today)
  const topProducts = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      sale: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: "COMPLETED",
      },
    },
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: "desc",
      },
    },
    take: 5,
  })

  // Get product names
  const productIds = topProducts.map((p: { productId: string }) => p.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
    select: {
      id: true,
      name: true,
    },
  })

  const productMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]))

  const topProductsWithNames = topProducts.map((p) => ({
    name: productMap.get(p.productId) || "Unknown",
    totalSold: Number(p._sum.quantity || 0),
  }))

  return {
    todaySales: Number(todaySales._sum.total || 0),
    todaySalesCount: todaySales._count,
    lowStockProducts: lowStockCount,
    pendingTransfers,
    topProducts: topProductsWithNames,
  }
}
