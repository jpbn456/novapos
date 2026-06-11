import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth/session-user'
import { applyInventoryMovement } from '@/lib/inventory'
import { roundQuantity } from '@/lib/quantity'
import { z } from 'zod'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

const updateSaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'El precio no puede ser negativo'),
})

const updateSaleSchema = z.object({
  items: z.array(updateSaleItemSchema).min(1, 'Al menos un producto requerido'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        location: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productNumber: true,
                price: true,
                cost: true,
                unitOfMeasure: true,
                customUnitName: true,
              },
            },
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      ...sale,
      subtotal: Number(sale.subtotal),
      tax: Number(sale.tax),
      total: Number(sale.total),
      items: sale.items.map((item: any) => ({
        ...item,
        quantity: roundQuantity(Number(item.quantity)),
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        product: {
          ...item.product,
          price: Number(item.product.price),
          cost: item.product.cost ? Number(item.product.cost) : null,
        },
      })),
    })
  } catch (error) {
    console.error('Error fetching sale:', error)
    return NextResponse.json({ error: 'Error al obtener la venta' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!MANAGER_ROLES.has(session.user.role || '')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const { id } = await params

    // Fetch sale with items and inventory movements
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        inventoryMovements: {
          where: { type: 'SALE' },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }

    if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
      return NextResponse.json(
        { error: 'No se puede editar una venta cancelada o reembolsada' },
        { status: 400 }
      )
    }

    // Check 24-hour window
    const now = new Date()
    const saleAge = now.getTime() - new Date(sale.createdAt).getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (saleAge > twentyFourHours) {
      return NextResponse.json(
        { error: 'Solo se pueden editar ventas dentro de las 24 horas posteriores a su creación' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateSaleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { items: newItems, paymentMethod, notes } = parsed.data
    const newProductIds = newItems.map((item) => item.productId)

    // Validate no duplicate products
    if (new Set(newProductIds).size !== newProductIds.length) {
      return NextResponse.json(
        { error: 'No se puede repetir el mismo producto' },
        { status: 400 }
      )
    }

    // Fetch products to get prices
    const products = await prisma.product.findMany({
      where: { id: { in: newProductIds } },
      select: { id: true, price: true, name: true },
    })

    if (products.length !== newProductIds.length) {
      return NextResponse.json(
        { error: 'Uno o más productos no existen' },
        { status: 400 }
      )
    }

    // Calculate new totals
    const newSubtotal = newItems.reduce(
      (sum, item) => sum + roundCurrency(item.quantity * item.unitPrice),
      0
    )
    const newTax = 0
    const newTotal = newSubtotal + newTax

    // Execute update in transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      const txDb = tx as any

      // Step 1: Reverse original stock (add back what was removed)
      for (const originalItem of sale.items) {
        const receivedQty = Number(originalItem.quantity)
        if (receivedQty > 0) {
          await applyInventoryMovement(txDb, {
            productId: originalItem.productId,
            locationId: sale.locationId,
            quantityDelta: receivedQty,
            type: 'ADJUSTMENT',
            userId,
            saleId: id,
            notes: `Reversión por edición de venta ${sale.invoiceNumber.slice(0, 8)}`,
          })
        }
      }

      // Step 2: Validate and apply new stock
      for (const item of newItems) {
        const inventory = await txDb.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: sale.locationId,
            },
          },
        })

        const currentQty = inventory ? Number(inventory.quantity) : 0
        if (currentQty < item.quantity) {
          throw new Error(`Stock insuficiente para el producto`)
        }

        await applyInventoryMovement(txDb, {
          productId: item.productId,
          locationId: sale.locationId,
          quantityDelta: -item.quantity,
          type: 'SALE',
          userId,
          saleId: id,
          notes: `Re-aplicado por edición de venta ${sale.invoiceNumber.slice(0, 8)}`,
        })
      }

      // Step 3: Delete old sale items
      await txDb.saleItem.deleteMany({
        where: { saleId: id },
      })

      // Step 4: Create new sale items
      await txDb.saleItem.createMany({
        data: newItems.map((item) => ({
          saleId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: roundCurrency(item.quantity * item.unitPrice),
        })),
      })

      // Step 5: Update sale totals
      const updateData: any = {
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
      }

      if (paymentMethod !== undefined) {
        updateData.paymentMethod = paymentMethod
      }
      if (notes !== undefined) {
        updateData.notes = notes || null
      }

      await txDb.sale.update({
        where: { id },
        data: updateData,
      })

      // Return full updated sale
      return txDb.sale.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  productNumber: true,
                  price: true,
                  unitOfMeasure: true,
                  customUnitName: true,
                },
              },
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
          location: true,
        },
      })
    })

    return NextResponse.json({
      ...updatedSale,
      subtotal: Number(updatedSale.subtotal),
      tax: Number(updatedSale.tax),
      total: Number(updatedSale.total),
      items: updatedSale.items.map((item: any) => ({
        ...item,
        quantity: roundQuantity(Number(item.quantity)),
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        product: {
          ...item.product,
          price: Number(item.product.price),
        },
      })),
    })
  } catch (error: any) {
    console.error('Error updating sale:', error)
    return NextResponse.json(
      { error: error.message || 'Error al editar la venta' },
      { status: 500 }
    )
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
