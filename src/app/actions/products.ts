"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult, ProductData } from "@/types/auth"

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: {
    category: true
  }
}>

const productSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  sku: z.string().max(50).optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive("Precio debe ser positivo"),
  cost: z.coerce.number().optional(),
  barcode: z.string().max(50).optional(),
  image: z.string().url().optional(),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
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

export async function getProducts(
  page = 1,
  limit = 20,
  search = "",
  categoryId?: string
): Promise<ActionResult<{ products: ProductData[]; total: number }>> {
  try {
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

    return {
      success: true,
      data: {
        products: products.map((p: ProductWithCategory) => ({
          ...p,
          price: Number(p.price),
          cost: p.cost ? Number(p.cost) : null,
        })),
        total,
      },
    }
  } catch (error) {
    console.error("Error fetching products:", error)
    return { success: false, error: "Error al obtener productos" }
  }
}

export async function getProduct(id: string): Promise<ActionResult<ProductData>> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    })

    if (!product) {
      return { success: false, error: "Producto no encontrado" }
    }

    return {
      success: true,
      data: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
      },
    }
  } catch (error) {
    console.error("Error fetching product:", error)
    return { success: false, error: "Error al obtener producto" }
  }
}

export async function createProduct(formData: FormData): Promise<ActionResult<ProductData>> {
  const rawData = {
    name: formData.get("name") as string,
    sku: formData.get("sku") as string || undefined,
    description: formData.get("description") as string || undefined,
    price: formData.get("price") as string,
    cost: formData.get("cost") as string || undefined,
    barcode: formData.get("barcode") as string || undefined,
    image: formData.get("image") as string || undefined,
    lowStockThreshold: formData.get("lowStockThreshold") as string || "10",
    categoryId: formData.get("categoryId") as string || undefined,
  }

  const result = productSchema.safeParse(rawData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  const slug = slugify(result.data.name)

  // Check for duplicate SKU
  if (result.data.sku) {
    const existingSku = await prisma.product.findUnique({
      where: { sku: result.data.sku },
    })
    if (existingSku) {
      return { success: false, error: "Ya existe un producto con ese SKU" }
    }
  }

  // Check for duplicate barcode
  if (result.data.barcode) {
    const existingBarcode = await prisma.product.findUnique({
      where: { barcode: result.data.barcode },
    })
    if (existingBarcode) {
      return { success: false, error: "Ya existe un producto con ese código de barras" }
    }
  }

  try {
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

    revalidatePath("/products")
    return {
      success: true,
      data: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
      },
    }
  } catch (error) {
    console.error("Error creating product:", error)
    return { success: false, error: "Error al crear producto" }
  }
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult<ProductData>> {
  const rawData = {
    name: formData.get("name") as string,
    sku: formData.get("sku") as string || undefined,
    description: formData.get("description") as string || undefined,
    price: formData.get("price") as string,
    cost: formData.get("cost") as string || undefined,
    barcode: formData.get("barcode") as string || undefined,
    image: formData.get("image") as string || undefined,
    lowStockThreshold: formData.get("lowStockThreshold") as string || "10",
    categoryId: formData.get("categoryId") as string || undefined,
  }

  const result = productSchema.safeParse(rawData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  const slug = slugify(result.data.name)

  // Check for duplicate SKU (excluding current product)
  if (result.data.sku) {
    const existingSku = await prisma.product.findFirst({
      where: { sku: result.data.sku, id: { not: id } },
    })
    if (existingSku) {
      return { success: false, error: "Ya existe un producto con ese SKU" }
    }
  }

  // Check for duplicate barcode (excluding current product)
  if (result.data.barcode) {
    const existingBarcode = await prisma.product.findFirst({
      where: { barcode: result.data.barcode, id: { not: id } },
    })
    if (existingBarcode) {
      return { success: false, error: "Ya existe un producto con ese código de barras" }
    }
  }

  try {
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

    revalidatePath("/products")
    return {
      success: true,
      data: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
      },
    }
  } catch (error) {
    console.error("Error updating product:", error)
    return { success: false, error: "Error al actualizar producto" }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<void>> {
  try {
    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    revalidatePath("/products")
    return { success: true }
  } catch (error) {
    console.error("Error deleting product:", error)
    return { success: false, error: "Error al eliminar producto" }
  }
}

export async function getCategories(): Promise<ActionResult<any[]>> {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { products: true },
        },
      },
    })
    return { success: true, data: categories }
  } catch (error) {
    console.error("Error fetching categories:", error)
    return { success: false, error: "Error al obtener categorías" }
  }
}
