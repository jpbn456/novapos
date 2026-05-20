import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateOrderSchema = z.object({
  supplierId: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED']).optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
})

const updateItemsSchema = z.array(
  z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    unitCost: z.number().positive(),
  })
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        location: true,
        user: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, productNumber: true, price: true },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get current order
    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Check if order can be modified
    if (currentOrder.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Cannot modify received order' },
        { status: 400 }
      )
    }

    if (currentOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot modify cancelled order' },
        { status: 400 }
      )
    }

    // Handle status change
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        PENDING: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['RECEIVED', 'CANCELLED'],
        RECEIVED: [],
        CANCELLED: [],
      }

      const allowed = validTransitions[currentOrder.status] || []
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentOrder.status}` },
          { status: 400 }
        )
      }
    }

    // Handle items update (only for PENDING orders)
    let updateData: any = { ...body }

    if (body.items && currentOrder.status === 'PENDING') {
      const validatedItems = updateItemsSchema.parse(body.items)

      // Recalculate totals
      const subtotal = validatedItems.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
      )
      const tax = subtotal * 0.21
      const total = subtotal + tax

      updateData = {
        ...updateData,
        subtotal,
        tax,
        total,
        items: {
          deleteMany: {},
          create: validatedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            subtotal: item.quantity * item.unitCost,
          })),
        },
      }
    } else if (body.items) {
      delete updateData.items // Can't update items if not PENDING
    }

    if (body.expectedDate) {
      updateData.expectedDate = new Date(body.expectedDate)
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get current order
    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Only PENDING orders can be deleted
    if (currentOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete PENDING orders' },
        { status: 400 }
      )
    }

    await prisma.purchaseOrder.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Purchase order deleted successfully' })
  } catch (error) {
    console.error('Error deleting purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    )
  }
}
