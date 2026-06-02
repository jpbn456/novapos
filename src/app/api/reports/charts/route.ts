import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { roundQuantity } from "@/lib/quantity";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default to last 30 days if not provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get sales in date range
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: "COMPLETED",
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate sales by day
    const days = eachDayOfInterval({ start, end });
    const salesByDay = days.map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = sales.filter(
        (sale) =>
          sale.createdAt >= dayStart && sale.createdAt <= dayEnd
      );

      return {
        date: format(day, "MMM dd"),
        value: daySales.reduce((sum, sale) => sum + Number(sale.total), 0),
      };
    });

    // Calculate top products
    const productSales: Record<string, { name: string; sold: number; revenue: number }> = {};
    
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.product.name,
            sold: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].sold += Number(item.quantity);
        productSales[item.productId].revenue += Number(item.subtotal);
      }
    }

    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        totalSold: roundQuantity(data.sold),
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate payment method breakdown
    const paymentBreakdown: Record<string, { count: number; total: number }> = {};
    
    for (const sale of sales) {
      if (!paymentBreakdown[sale.paymentMethod]) {
        paymentBreakdown[sale.paymentMethod] = { count: 0, total: 0 };
      }
      paymentBreakdown[sale.paymentMethod].count += 1;
      paymentBreakdown[sale.paymentMethod].total += Number(sale.total);
    }

    const paymentMethods = Object.entries(paymentBreakdown).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    }));

    return NextResponse.json({
      data: {
        salesByDay,
        topProducts,
        paymentBreakdown: paymentMethods,
      },
    });
  } catch (error) {
    console.error("Charts report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch charts data" },
      { status: 500 }
    );
  }
}
