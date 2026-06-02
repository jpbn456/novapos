import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { applyInventoryMovement } from '@/lib/inventory'
import { derivePurchaseOrderStatus, serializePurchaseOrder } from '@/lib/purchase-orders'
import { resolveSessionUserId } from '@/lib/auth/session-user'
import { z } from 'zod'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

const receiveOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantityReceived: z.number().positive(),
      })
    )
    .min(1, 'Indicá al menos un item a recibir'),
  notes: z.string().optional(),
})

async function ensureManagerAccess() {
  const session = await auth()

  if (!session?.user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }), userId: null }
  }

  if (!MANAGER_ROLES.has(session.user.role || '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }), userId: null }
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Sesión inválida. Volvé a iniciar sesión.' }, { status: 401 }),
      userId: null,
    }
  }

  return { error: null, userId }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await ensureManagerAccess()
    if (access.error) return access.error

    if (!access.userId) {
      return NextResponse.json({ error: 'Sesión inválida. Volvé a iniciar sesión.' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = receiveOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const uniqueItemIds = new Set(parsed.data.items.map((item) => item.itemId))
    if (uniqueItemIds.size !== parsed.data.items.length) {
      return NextResponse.json(
        { error: 'No repitas items en la misma recepción' },
        { status: 400 }
      )
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, productNumber: true, unitOfMeasure: true, customUnitName: true },
            },
          },
        },
        location: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Only confirmed or partially received orders can receive stock' },
        { status: 400 }
      )
    }

    const itemsById = new Map(order.items.map((item) => [item.id, item]))

    for (const receivedItem of parsed.data.items) {
      const currentItem = itemsById.get(receivedItem.itemId)

      if (!currentItem) {
        return NextResponse.json(
          { error: 'El item recibido no pertenece a la orden' },
          { status: 400 }
        )
      }

      const pendingQty = Number(currentItem.quantity) - Number(currentItem.receivedQty)
      if (receivedItem.quantityReceived > pendingQty) {
        return NextResponse.json(
          { error: `No podés recibir más de lo pendiente para ${currentItem.product.name}` },
          { status: 400 }
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const txDb = tx as any
      const nextItemsState = order.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        receivedQty: Number(item.receivedQty),
      }))

      for (const receivedItem of parsed.data.items) {
        const currentItem = itemsById.get(receivedItem.itemId)!
        const nextReceivedQty = Number(currentItem.receivedQty) + receivedItem.quantityReceived

        await txDb.purchaseOrderItem.update({
          where: { id: currentItem.id },
          data: {
            receivedQty: nextReceivedQty,
          },
        })

        const nextItemState = nextItemsState.find((item) => item.id === currentItem.id)
        if (nextItemState) {
          nextItemState.receivedQty = Number(nextReceivedQty)
        }

        await applyInventoryMovement(txDb, {
          productId: currentItem.productId,
          locationId: order.locationId,
          quantityDelta: receivedItem.quantityReceived,
          type: 'PURCHASE_RECEIPT',
          userId: access.userId,
          purchaseOrderId: order.id,
          notes: parsed.data.notes || `Ingreso parcial por orden ${order.orderNumber}`,
        })
      }

      const nextStatus = derivePurchaseOrderStatus(nextItemsState, 'CONFIRMED')

      const updatedOrder = await txDb.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedDate: nextStatus === 'RECEIVED' ? new Date() : null,
        },
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

      return updatedOrder
    })

    return NextResponse.json(serializePurchaseOrder(result))
  } catch (error) {
    console.error('Error receiving purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to receive purchase order' },
      { status: 500 }
    )
  }
}
