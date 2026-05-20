"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult } from "@/types/auth"
import { auth } from "@/auth"
import { resolveSessionUserId } from "@/lib/auth/session-user"
import { applyInventoryMovement } from "@/lib/inventory"
import { getActivePromotionsData } from "@/lib/promotion-data"
import { calculatePromotionalPricing } from "@/lib/pricing"

const db = prisma as any

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const saleSchema = z.object({
  locationId: z.string(),
  cashSessionId: z.string().min(1, "Caja requerida"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  items: z.array(saleItemSchema).min(1, "Al menos un producto"),
  notes: z.string().optional(),
})

export async function createSale(data: {
  locationId: string
  cashSessionId: string
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER"
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
  }>
  notes?: string
}): Promise<ActionResult<any>> {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "No autenticado" }
  }

  const userId = await resolveSessionUserId(session)

  if (!userId) {
    return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." }
  }

  const result = saleSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      error: "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  const { locationId, cashSessionId, paymentMethod, items, notes } = result.data
  try {
    const cashSession = await db.cashSession.findUnique({
      where: { id: cashSessionId },
      select: { id: true, locationId: true, status: true },
    })

    if (!cashSession || cashSession.locationId !== locationId) {
      return { success: false, error: "La caja seleccionada no corresponde a la sucursal" }
    }

    if (cashSession.status !== "OPEN") {
      return { success: false, error: "La caja seleccionada está cerrada" }
    }

    const products = await db.product.findMany({
      where: {
        id: { in: items.map((item) => item.productId) },
      },
      select: {
        id: true,
        price: true,
      },
    })

    const productPriceMap = new Map(products.map((product: any) => [product.id, Number(product.price)]))
    const activePromotions = await getActivePromotionsData()
    const pricing = calculatePromotionalPricing(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: productPriceMap.get(item.productId) ?? Number(item.unitPrice),
      })),
      activePromotions
    )

    // Calculate totals
    const subtotal = pricing.subtotal
    const tax = 0 // No tax for now
    const total = subtotal + tax

    // Use Prisma transaction for atomicity
    const sale = await prisma.$transaction(async (tx) => {
      const txDb = tx as any

      // Validate stock for all items
      for (const item of items) {
        const inventory = await txDb.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId,
            },
          },
        })

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(
            `Stock insuficiente para el producto`
          )
        }
      }

      // Create sale
      const createdSale = await txDb.sale.create({
        data: {
          userId,
          locationId,
          cashSessionId,
          subtotal,
          tax,
          total,
          paymentMethod,
          notes: notes || null,
          items: {
            create: pricing.lines.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.effectiveUnitPrice,
              subtotal: item.discountedSubtotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          location: true,
        },
      })

      for (const item of items) {
        await applyInventoryMovement(txDb, {
          productId: item.productId,
          locationId,
          quantityDelta: -item.quantity,
          type: "SALE",
          userId,
          saleId: createdSale.id,
          notes: "Salida por venta",
        })
      }

      return createdSale
    })

    revalidatePath("/pos")
    revalidatePath("/dashboard")

    return {
      success: true,
      data: {
        ...sale,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax),
        total: Number(sale.total),
        savings: pricing.savings,
        appliedPromotions: pricing.appliedPromotions,
        items: sale.items.map((item: any) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
          product: {
            ...item.product,
            price: Number(item.product.price),
            cost: item.product.cost ? Number(item.product.cost) : null,
          },
        })),
      },
    }
  } catch (error: any) {
    console.error("Error creating sale:", error)
    return { success: false, error: error.message || "Error al crear venta" }
  }
}

export async function getTodaySales(locationId?: string): Promise<ActionResult<any[]>> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: "COMPLETED",
        ...(locationId ? { locationId } : {}),
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        location: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return {
      success: true,
      data: sales.map((sale) => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax),
        total: Number(sale.total),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        })),
      })),
    }
  } catch (error) {
    console.error("Error fetching sales:", error)
    return { success: false, error: "Error al obtener ventas" }
  }
}
