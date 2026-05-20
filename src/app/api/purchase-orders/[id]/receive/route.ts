import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyInventoryMovement } from '@/lib/inventory'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get the order
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
        location: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Check if order can be received
    if (order.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Only CONFIRMED orders can be received' },
        { status: 400 }
      )
    }

    // Verify all items can be received (no partial receive)
    const hasPartialItems = order.items.some(
      (item) => item.receivedQty < item.quantity
    )
    if (hasPartialItems) {
      return NextResponse.json(
        { error: 'Must receive all items or cancel order' },
        { status: 400 }
      )
    }

    // Use transaction to update inventory atomically
    const result = await prisma.$transaction(async (tx) => {
      const txDb = tx as any

      // Update order status to RECEIVED
      const updatedOrder = await txDb.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
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

      // Update inventory for each item
      for (const item of order.items) {
        await applyInventoryMovement(txDb, {
          productId: item.productId,
          locationId: order.locationId,
          quantityDelta: item.quantity,
          type: 'PURCHASE_RECEIPT',
          purchaseOrderId: order.id,
          notes: `Ingreso por orden ${order.orderNumber}`,
        })
      }

      return updatedOrder
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error receiving purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to receive purchase order' },
      { status: 500 }
    )
  }
}
