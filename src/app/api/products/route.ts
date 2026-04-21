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

// GET /api/products - List products with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const categoryId = searchParams.get("categoryId")

    const where: any = {
      isActive: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: true,
        },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        cost: p.cost ? Number(p.cost) : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 })
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const result = productSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const slug = slugify(result.data.name)

    // Check for duplicate SKU
    if (result.data.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: result.data.sku },
      })
      if (existingSku) {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU" },
          { status: 400 }
        )
      }
    }

    // Check for duplicate barcode
    if (result.data.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: result.data.barcode },
      })
      if (existingBarcode) {
        return NextResponse.json(
          { error: "Ya existe un producto con ese código de barras" },
          { status: 400 }
        )
      }
    }

    const product = await prisma.product.create({
      data: {
        ...result.data,
        slug,
        cost: result.data.cost || null,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(
      {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 })
  }
}