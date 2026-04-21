import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const locationId = searchParams.get("locationId");
    const productId = searchParams.get("productId");

    // Build where clause
    const where: any = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.createdAt = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      where.createdAt = {
        lte: new Date(endDate),
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

    // Calculate summary
    const summary = {
      totalSales: reportRows.reduce((sum, row) => sum + row.total, 0),
      totalItems: reportRows.reduce((sum, row) => sum + row.quantity, 0),
      totalTax: reportRows.reduce((sum, row) => sum + row.tax, 0),
      averageTicket: reportRows.length > 0 
        ? reportRows.reduce((sum, row) => sum + row.total, 0) / new Set(reportRows.map(r => r.invoiceNumber)).size 
        : 0,
      salesCount: new Set(reportRows.map(r => r.invoiceNumber)).size,
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