import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { roundQuantity } from "@/lib/quantity";

function parseDateBoundary(value: string | null, endOfDay = false) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const locationId = searchParams.get("locationId");
    const productId = searchParams.get("productId");
    const parsedStartDate = parseDateBoundary(startDate);
    const parsedEndDate = parseDateBoundary(endDate, true);

    // Build where clause
    const where: any = {};
    
    if (parsedStartDate && parsedEndDate) {
      where.createdAt = {
        gte: parsedStartDate,
        lte: parsedEndDate,
      };
    } else if (parsedStartDate) {
      where.createdAt = {
        gte: parsedStartDate,
      };
    } else if (parsedEndDate) {
      where.createdAt = {
        lte: parsedEndDate,
      };
    }
    
    if (locationId) {
      where.locationId = locationId;
    }

    // Get all sales with items
    const sales = await prisma.sale.findMany({
      where,
      include: {
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

    // Group items by sale (invoice)
    const groups: any[] = [];

    for (const sale of sales) {
      const items = sale.items
        .filter((item) => !productId || item.productId === productId)
        .map((item) => ({
          id: item.id,
          product: item.product.name,
          quantity: roundQuantity(Number(item.quantity)),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        }));

      if (items.length === 0) continue;

      groups.push({
        invoiceNumber: sale.invoiceNumber,
        date: format(sale.createdAt, "yyyy-MM-dd"),
        location: sale.location.name,
        cashier: sale.user.name || "N/A",
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        tax: Number(sale.tax),
        total: Number(sale.total),
        items,
      });
    }

    // Calculate summary (per unique sale, not per item row)
    const totalSales = groups.reduce((sum, g) => sum + g.total, 0);
    const totalTax = groups.reduce((sum, g) => sum + g.tax, 0);
    const totalItems = groups.reduce((sum, g) => sum + g.items.reduce((is: number, i: any) => is + i.quantity, 0), 0);
    const salesCount = groups.length;

    const summary = {
      totalSales,
      totalItems,
      totalTax,
      averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
      salesCount,
    };

    return NextResponse.json({ data: groups, summary });
  } catch (error) {
    console.error("Sales report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales report" },
      { status: 500 }
    );
  }
}
