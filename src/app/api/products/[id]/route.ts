import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  description: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().optional(),
  barcode: z.string().max(50).optional(),
  image: z.string().url().optional(),
  lowStockThreshold: z.number().int().min(0).default(10),
  categoryId: z.string().optional(),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      ...product,
      price: Number(product.price),
      cost: product.cost ? Number(product.cost) : null,
    })
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const result = productSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const slug = slugify(result.data.name)

    // Check for duplicate SKU (excluding current product)
    if (result.data.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: result.data.sku, id: { not: id } },
      })
      if (existingSku) {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU" },
          { status: 400 }
        )
      }
    }

    // Check for duplicate barcode (excluding current product)
    if (result.data.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode: result.data.barcode, id: { not: id } },
      })
      if (existingBarcode) {
        return NextResponse.json(
          { error: "Ya existe un producto con ese código de barras" },
          { status: 400 }
        )
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...result.data,
        slug,
        cost: result.data.cost || null,
        categoryId: result.data.categoryId || null,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json({
      ...product,
      price: Number(product.price),
      cost: product.cost ? Number(product.cost) : null,
    })
  } catch (error) {
    console.error("Error updating product:", error)
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Soft delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 })
  }
}