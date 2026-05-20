import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveSessionUserId } from "@/lib/auth/session-user"
import { applyInventoryMovement } from "@/lib/inventory"
import { getActivePromotionsData } from "@/lib/promotion-data"
import { calculatePromotionalPricing } from "@/lib/pricing"
import { z } from "zod"

const db = prisma as any

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const saleSchema = z.object({
  locationId: z.string(),
  cashSessionId: z.string().min(1),
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
        items: sale.items.map((item: any) => ({
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
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)

    if (!userId) {
      return NextResponse.json({ error: "Sesión inválida. Volvé a iniciar sesión." }, { status: 401 })
    }

    const body = await request.json()
    const result = saleSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { locationId, cashSessionId, paymentMethod, items, notes } = result.data

    const cashSession = await db.cashSession.findUnique({
      where: { id: cashSessionId },
      select: { id: true, locationId: true, status: true },
    })

    if (!cashSession || cashSession.locationId !== locationId) {
      return NextResponse.json({ error: "La caja seleccionada no corresponde a la sucursal" }, { status: 400 })
    }

    if (cashSession.status !== "OPEN") {
      return NextResponse.json({ error: "La caja seleccionada está cerrada" }, { status: 400 })
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

    const productPriceMap = new Map<string, number>(products.map((product: any) => [product.id, Number(product.price)]))
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
    const tax = 0
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
          throw new Error("Stock insuficiente para el producto")
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

    return NextResponse.json(
      {
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
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Error creating sale:", error)
    return NextResponse.json({ error: error.message || "Error al crear venta" }, { status: 500 })
  }
}
