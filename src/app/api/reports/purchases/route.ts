import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { roundQuantity } from "@/lib/quantity";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supplierId = searchParams.get("supplierId");
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");

    // Build where clause
    const where: any = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    
    if (supplierId) {
      where.supplierId = supplierId;
    }
    
    if (locationId) {
      where.locationId = locationId;
    }
    
    if (status) {
      where.status = status;
    }

    // Get purchase orders with items
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        location: true,
        user: {
          select: { name: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group items by order
    const groups: any[] = [];

    for (const order of orders) {
      const items = order.items.map((item) => ({
        id: item.id,
        product: item.product.name,
        quantity: roundQuantity(Number(item.quantity)),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal),
      }));

      groups.push({
        orderNumber: order.orderNumber,
        date: format(order.createdAt, "yyyy-MM-dd"),
        supplier: order.supplier.name,
        location: order.location.name,
        user: order.user.name || "N/A",
        status: order.status,
        total: Number(order.total),
        expectedDate: order.expectedDate ? format(order.expectedDate, "yyyy-MM-dd") : undefined,
        receivedDate: order.receivedDate ? format(order.receivedDate, "yyyy-MM-dd") : undefined,
        items,
      });
    }

    // Calculate summary
    const totalValue = groups.reduce((sum, g) => sum + g.items.reduce((is: number, i: any) => is + i.subtotal, 0), 0);
    const totalItems = groups.reduce((sum, g) => sum + g.items.reduce((is: number, i: any) => is + i.quantity, 0), 0);

    const summary = {
      totalOrders: groups.length,
      totalItems,
      totalValue,
      pendingCount: groups.filter(g => ["PENDING", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(g.status)).length,
      receivedCount: groups.filter(g => g.status === "RECEIVED").length,
    };

    return NextResponse.json({ data: groups, summary });
  } catch (error) {
    console.error("Purchase report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase report" },
      { status: 500 }
    );
  }
}
