import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const saleSchema = z.object({
  locationId: z.string(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  items: z.array(saleItemSchema).min(1),
  notes: z.string().optional(),
})

// GET /api/sales - List today's sales
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")

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

    return NextResponse.json(
      sales.map((sale) => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax),
        total: Number(sale.total),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        })),
      }))
    )
  } catch (error) {
    console.error("Error fetching sales:", error)
    return NextResponse.json({ error: "Error al obtener ventas" }, { status: 500 })
  }
}

// POST /api/sales - Create new sale
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const result = saleSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { locationId, paymentMethod, items, notes } = result.data
    const userId = session.user.id

    // Calculate totals
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const tax = 0
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
          throw new Error("Stock insuficiente para el producto")
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

    return NextResponse.json(
      {
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
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Error creating sale:", error)
    return NextResponse.json({ error: error.message || "Error al crear venta" }, { status: 500 })
  }
}