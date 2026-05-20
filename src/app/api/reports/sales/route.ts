import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";

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

    // Transform to flat report rows (one per item)
    let reportRows: any[] = [];
    
    for (const sale of sales) {
      if (productId) {
        // Filter items by product
        const filteredItems = sale.items.filter((item) => item.productId === productId);
        for (const item of filteredItems) {
          reportRows.push({
            id: item.id,
            invoiceNumber: sale.invoiceNumber,
            date: format(sale.createdAt, "yyyy-MM-dd"),
            location: sale.location.name,
            cashier: sale.user.name || "N/A",
            product: item.product.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            tax: Number(sale.tax),
            total: Number(sale.total),
            paymentMethod: sale.paymentMethod,
            status: sale.status,
          });
        }
      } else {
        // Include all items
        for (const item of sale.items) {
          reportRows.push({
            id: item.id,
            invoiceNumber: sale.invoiceNumber,
            date: format(sale.createdAt, "yyyy-MM-dd"),
            location: sale.location.name,
            cashier: sale.user.name || "N/A",
            product: item.product.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            tax: Number(sale.tax),
            total: Number(sale.total),
            paymentMethod: sale.paymentMethod,
            status: sale.status,
          });
        }
      }
    }

    // Calculate summary (per unique sale, not per item row)
    const uniqueSales = new Map<string, { total: number; tax: number }>()
    for (const row of reportRows) {
      if (!uniqueSales.has(row.invoiceNumber)) {
        uniqueSales.set(row.invoiceNumber, { total: row.total, tax: row.tax })
      }
    }
    const saleTotals = Array.from(uniqueSales.values())
    const totalSales = saleTotals.reduce((sum, s) => sum + s.total, 0)
    const totalTax = saleTotals.reduce((sum, s) => sum + s.tax, 0)
    const salesCount = uniqueSales.size

    const summary = {
      totalSales,
      totalItems: reportRows.reduce((sum, row) => sum + row.quantity, 0),
      totalTax,
      averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
      salesCount,
    };

    return NextResponse.json({ data: reportRows, summary });
  } catch (error) {
    console.error("Sales report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales report" },
      { status: 500 }
    );
  }
}
