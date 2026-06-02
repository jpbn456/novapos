import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth/session-user'
import { calculatePurchaseOrderTotals, serializePurchaseOrder } from '@/lib/purchase-orders'
import { z } from 'zod'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

const createOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  locationId: z.string().min(1, 'Location is required'),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.number().int().positive('Quantity must be positive'),
      unitCost: z.number().positive('Unit cost must be positive'),
    })
  ).min(1, 'At least one item is required'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!MANAGER_ROLES.has(session.user.role || '')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const locationId = searchParams.get('locationId')
    const status = searchParams.get('status')

    const where = {
      ...(supplierId && { supplierId }),
      ...(locationId && { locationId }),
      ...(status && { status: status as any }),
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        location: true,
        user: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, productNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders.map((order) => serializePurchaseOrder(order)))
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Sesión inválida. Volvé a iniciar sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createOrderSchema.parse(body)

    const { subtotal, tax, total } = calculatePurchaseOrderTotals(validatedData.items)

    // Generate order number
    const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: validatedData.supplierId,
        locationId: validatedData.locationId,
        userId,
        expectedDate: validatedData.expectedDate
          ? new Date(validatedData.expectedDate)
          : null,
        notes: validatedData.notes,
        subtotal,
        tax,
        total,
        items: {
          create: validatedData.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            subtotal: item.quantity * item.unitCost,
          })),
        },
      },
      include: {
        supplier: true,
        location: true,
        items: {
          include: {
            product: {
              select: { id: true, name: true, productNumber: true },
            },
          },
        },
      },
    })

    return NextResponse.json(serializePurchaseOrder(order), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}
