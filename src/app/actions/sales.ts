"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult } from "@/types/auth"
import { auth } from "@/auth"

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const saleSchema = z.object({
  locationId: z.string(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  items: z.array(saleItemSchema).min(1, "Al menos un producto"),
  notes: z.string().optional(),
})

export async function createSale(data: {
  locationId: string
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER"
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
  }>
  notes?: string
}): Promise<ActionResult<any>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autenticado" }
  }

  const result = saleSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      error: "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  const { locationId, paymentMethod, items, notes } = result.data
  const userId = session.user.id

  try {
    // Calculate totals
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const tax = 0 // No tax for now
    const total = subtotal + tax

    // Use Prisma transaction for atomicity
    const sale = await prisma.$transaction(async (tx) => {
      // Validate stock for all items
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
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

        // Deduct inventory
        await tx.inventory.update({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId,
            },
          },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        })
      }

      // Create sale
      const createdSale = await tx.sale.create({
        data: {
          userId,
          locationId,
          subtotal,
          tax,
          total,
          paymentMethod,
          notes: notes || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
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
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
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
