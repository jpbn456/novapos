import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { roundQuantity } from "@/lib/quantity";

const db = prisma as any

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const locationId = searchParams.get("locationId");
    const lowStockOnly = searchParams.get("lowStock");

    // Build where clause for products
    const where: any = {
      isActive: true,
    };

    // Get all inventory with product and location details
    const inventory = await db.inventory.findMany({
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });

    // Filter by location if provided
    let filteredInventory = locationId 
      ? inventory.filter((inv: any) => inv.locationId === locationId)
      : inventory;

    // Filter by low stock if requested
    if (lowStockOnly === "true") {
      filteredInventory = filteredInventory.filter(
        (inv: any) => Number(inv.quantity) <= Number(inv.product.lowStockThreshold)
      );
    }

    // Filter by date range (based on last update)
    let reportRows = filteredInventory.map((inv: any) => ({
      id: inv.id,
      productNumber: (inv.product as any).productNumber,
      product: inv.product.name,
      category: inv.product.category?.name || "Sin categoría",
      location: inv.location.name,
      quantity: roundQuantity(Number(inv.quantity)),
      cost: Number(inv.product.cost || 0),
      price: Number(inv.product.price),
      stockValue: Number(inv.product.cost || 0) * Number(inv.quantity),
      isLowStock: Number(inv.quantity) <= Number(inv.product.lowStockThreshold),
    }));

    // Calculate summary
    const locations = new Set(reportRows.map((r: any) => r.location));
    const summary = {
      totalProducts: reportRows.length,
      totalLocations: locations.size,
      totalStockValue: reportRows.reduce((sum: number, row: any) => sum + row.stockValue, 0),
      lowStockCount: reportRows.filter((r: any) => r.isLowStock).length,
    };

    return NextResponse.json({ data: reportRows, summary });
  } catch (error) {
    console.error("Inventory report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory report" },
      { status: 500 }
    );
  }
}
