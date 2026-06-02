import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  calculatePurchaseOrderTotals,
  derivePurchaseOrderStatus,
  hasReceivedItems,
  serializePurchaseOrder,
} from '@/lib/purchase-orders'
import { z } from 'zod'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

const updateItemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().positive(),
      unitCost: z.number().positive(),
    })
  )
  .min(1, 'At least one item is required')

const updateOrderSchema = z.object({
  supplierId: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: updateItemsSchema.optional(),
})

async function ensureManagerAccess() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!MANAGER_ROLES.has(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessError = await ensureManagerAccess()
    if (accessError) return accessError

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
              select: { id: true, name: true, productNumber: true, price: true, unitOfMeasure: true, customUnitName: true },
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

    return NextResponse.json(serializePurchaseOrder(order))
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
    const accessError = await ensureManagerAccess()
    if (accessError) return accessError

    const { id } = await params
    const body = await request.json()
    const parsed = updateOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

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

    const data = parsed.data
    const orderHasReceipts = hasReceivedItems(currentOrder.items)

    if (data.locationId && data.locationId !== currentOrder.locationId && orderHasReceipts) {
      return NextResponse.json(
        { error: 'Cannot change location after receiving stock' },
        { status: 400 }
      )
    }

    if (data.status) {
      if (data.status === 'RECEIVED' || data.status === 'PARTIALLY_RECEIVED') {
        return NextResponse.json(
          { error: 'Use the receive flow to update received stock' },
          { status: 400 }
        )
      }

      if (orderHasReceipts) {
        return NextResponse.json(
          { error: 'Cannot change status manually after receiving stock' },
          { status: 400 }
        )
      }

      const validTransitions: Record<string, string[]> = {
        PENDING: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['CANCELLED'],
        PARTIALLY_RECEIVED: [],
        RECEIVED: [],
        CANCELLED: [],
      }

      const allowed = validTransitions[currentOrder.status] || []
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentOrder.status}` },
          { status: 400 }
        )
      }
    }

    let updateData: any = {
      supplierId: data.supplierId,
      locationId: data.locationId,
      notes: data.notes === undefined ? undefined : data.notes || null,
      status: data.status,
    }

    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null
    }

    if (data.items) {
      const productIds = data.items.map((item) => item.productId)
      if (new Set(productIds).size !== productIds.length) {
        return NextResponse.json(
          { error: 'No se puede repetir el mismo producto en la orden' },
          { status: 400 }
        )
      }

      const currentItemsByProductId = new Map(currentOrder.items.map((item) => [item.productId, item]))

      for (const item of data.items) {
        const currentItem = currentItemsByProductId.get(item.productId)
        const receivedQty = Number(currentItem?.receivedQty || 0)

        if (item.quantity < receivedQty) {
          return NextResponse.json(
            { error: 'No podés bajar una cantidad por debajo de lo ya recibido' },
            { status: 400 }
          )
        }
      }

      for (const currentItem of currentOrder.items) {
        const stillPresent = data.items.some((item) => item.productId === currentItem.productId)

        if (!stillPresent && currentItem.receivedQty > 0) {
          return NextResponse.json(
            { error: 'No podés eliminar un producto que ya recibió stock' },
            { status: 400 }
          )
        }
      }

      const { subtotal, tax, total } = calculatePurchaseOrderTotals(data.items)
        const nextItemsState = data.items.map((item) => ({
          ...item,
        receivedQty: Number(currentItemsByProductId.get(item.productId)?.receivedQty || 0),
      }))

      const nextStatus = derivePurchaseOrderStatus(
        nextItemsState,
        currentOrder.status === 'PENDING' ? 'PENDING' : 'CONFIRMED'
      )

      updateData = {
        ...updateData,
        subtotal,
        tax,
        total,
        status: nextStatus,
        receivedDate: nextStatus === 'RECEIVED' ? currentOrder.receivedDate || new Date() : null,
        items: {
          deleteMany: {},
          create: nextItemsState.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            receivedQty: item.receivedQty,
            unitCost: item.unitCost,
            subtotal: item.quantity * item.unitCost,
          })),
        },
      }
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
              select: { id: true, name: true, productNumber: true, unitOfMeasure: true, customUnitName: true },
            },
          },
        },
      },
    })

    return NextResponse.json(serializePurchaseOrder(order))
  } catch (error) {
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
    const accessError = await ensureManagerAccess()
    if (accessError) return accessError

    const { id } = await params

    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    if (currentOrder.status !== 'PENDING' || hasReceivedItems(currentOrder.items)) {
      return NextResponse.json(
        { error: 'Can only delete untouched PENDING orders' },
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
