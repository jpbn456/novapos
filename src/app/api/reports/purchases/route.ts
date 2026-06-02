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

    // Transform to flat report rows (one per item)
    const reportRows: any[] = [];
    
    for (const order of orders) {
      for (const item of order.items) {
        reportRows.push({
          id: item.id,
          orderNumber: order.orderNumber,
          date: format(order.createdAt, "yyyy-MM-dd"),
          supplier: order.supplier.name,
          location: order.location.name,
          user: order.user.name || "N/A",
          status: order.status,
          product: item.product.name,
          quantity: roundQuantity(Number(item.quantity)),
          unitCost: Number(item.unitCost),
          subtotal: Number(item.subtotal),
          total: Number(order.total),
          expectedDate: order.expectedDate ? format(order.expectedDate, "yyyy-MM-dd") : undefined,
          receivedDate: order.receivedDate ? format(order.receivedDate, "yyyy-MM-dd") : undefined,
        });
      }
    }

    // Calculate summary
    const summary = {
      totalOrders: new Set(reportRows.map(r => r.orderNumber)).size,
      totalItems: reportRows.reduce((sum, row) => sum + row.quantity, 0),
      totalValue: reportRows.reduce((sum, row) => sum + row.subtotal, 0),
      pendingCount: reportRows.filter(r => ["PENDING", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(r.status)).length,
      receivedCount: reportRows.filter(r => r.status === "RECEIVED").length,
    };

    return NextResponse.json({ data: reportRows, summary });
  } catch (error) {
    console.error("Purchase report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase report" },
      { status: 500 }
    );
  }
}
