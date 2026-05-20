"use server"

import { prisma } from "@/lib/prisma"

const db = prisma as any

export async function getInventoryMovements(locationId?: string, limit = 100) {
  const movements = await db.inventoryMovement.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          productNumber: true,
          name: true,
          unitOfMeasure: true,
          customUnitName: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return movements.map((movement: any) => ({
    ...movement,
    product: {
      ...movement.product,
      customUnitName: movement.product.customUnitName || null,
    },
  }))
}
