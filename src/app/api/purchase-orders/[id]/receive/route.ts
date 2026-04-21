import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      // Update order status to RECEIVED
      const updatedOrder = await tx.purchaseOrder.update({
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
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      })

      // Update inventory for each item
      for (const item of order.items) {
        // Try to update existing inventory
        const existingInventory = await tx.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: order.locationId,
            },
          },
        })

        if (existingInventory) {
          // Update existing inventory
          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: existingInventory.quantity + item.quantity,
            },
          })
        } else {
          // Create new inventory record
          await tx.inventory.create({
            data: {
              productId: item.productId,
              locationId: order.locationId,
              quantity: item.quantity,
            },
          })
        }
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