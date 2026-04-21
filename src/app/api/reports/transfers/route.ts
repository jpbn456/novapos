import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const fromLocationId = searchParams.get("fromLocationId");
    const toLocationId = searchParams.get("toLocationId");
    const status = searchParams.get("status");

    // Build where clause
    const where: any = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    
    if (fromLocationId) {
      where.fromLocationId = fromLocationId;
    }
    
    if (toLocationId) {
      where.toLocationId = toLocationId;
    }
    
    if (status) {
      where.status = status;
    }

    // Get transfers with items
    const transfers = await prisma.transfer.findMany({
      where,
      include: {
        fromLocation: true,
        toLocation: true,
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
    
    for (const transfer of transfers) {
      for (const item of transfer.items) {
        reportRows.push({
          id: item.id,
          reference: transfer.reference,
          date: format(transfer.createdAt, "yyyy-MM-dd"),
          fromLocation: transfer.fromLocation.name,
          toLocation: transfer.toLocation.name,
          user: transfer.user.name || "N/A",
          status: transfer.status,
          product: item.product.name,
          quantity: item.quantity,
          notes: transfer.notes,
        });
      }
    }

    // Calculate summary
    const summary = {
      totalTransfers: new Set(reportRows.map(r => r.reference)).size,
      totalItems: reportRows.reduce((sum, row) => sum + row.quantity, 0),
      pendingCount: reportRows.filter(r => r.status === "PENDING").length,
      completedCount: reportRows.filter(r => r.status === "COMPLETED").length,
    };

    return NextResponse.json({ data: reportRows, summary });
  } catch (error) {
    console.error("Transfer report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfer report" },
      { status: 500 }
    );
  }
}