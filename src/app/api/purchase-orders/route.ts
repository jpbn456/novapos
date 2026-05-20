import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth/session-user'
import { z } from 'zod'

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

const updateOrderSchema = z.object({
  supplierId: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED']).optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
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
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
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

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: 'Sesión inválida. Volvé a iniciar sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createOrderSchema.parse(body)

    // Calculate totals
    const subtotal = validatedData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    )
    const tax = subtotal * 0.21 // 21% tax
    const total = subtotal + tax

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
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    })

    return NextResponse.json(order, { status: 201 })
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
