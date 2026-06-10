"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult, ProductData } from "@/types/auth"
import { auth } from "@/auth"
import { resolveSessionUserId } from "@/lib/auth/session-user"
import { applyInventoryMovement } from "@/lib/inventory"
import { roundQuantity } from "@/lib/quantity"

const db = prisma as any
const PURCHASE_PRODUCT_ROLES = new Set(["ADMIN", "MANAGER"])

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: {
    category: true
  }
}>

const productSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().optional(),
  price: z.coerce.number().positive("Precio debe ser positivo"),
  cost: z.coerce.number().optional(),
  barcode: z.string().max(50).optional(),
  image: z.string().url().optional(),
  lowStockThreshold: z.coerce.number().min(0).default(10),
  unitOfMeasure: z.enum(["UNIT", "ML", "G", "KG", "LT", "OTHER"]).default("UNIT"),
  customUnitName: z.string().max(40).optional(),
  initialStock: z.coerce.number().min(0).default(0),
  initialLocationId: z.string().optional(),
  categoryId: z.string().optional(),
})

const purchaseOrderProductSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  price: z.number().min(0).optional(),
  cost: z.number().positive("Costo debe ser positivo"),
  barcode: z.string().max(50).optional(),
  unitOfMeasure: z.enum(["UNIT", "ML", "G", "KG", "LT", "OTHER"]).default("UNIT"),
  customUnitName: z.string().max(40).optional(),
  supplierId: z.string().optional(),
})

function serializeProduct(p: any): ProductData {
  return {
    ...p,
    price: Number(p.price),
    cost: p.cost ? Number(p.cost) : null,
    lowStockThreshold: roundQuantity(Number(p.lowStockThreshold)),
    customUnitName: p.customUnitName || null,
  }
}

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
      const numericSearch = Number(search)
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        ...(Number.isInteger(numericSearch) ? [{ productNumber: numericSearch }] : []),
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: true,
        },
      }),
      db.product.count({ where }),
    ])

    return {
      success: true,
      data: {
        products: products.map((p: ProductWithCategory) => ({
          ...serializeProduct(p),
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
    const product = await db.product.findUnique({
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
        ...serializeProduct(product),
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
    description: formData.get("description") as string || undefined,
    price: formData.get("price") as string,
    cost: formData.get("cost") as string || undefined,
    barcode: formData.get("barcode") as string || undefined,
    image: formData.get("image") as string || undefined,
    lowStockThreshold: formData.get("lowStockThreshold") as string || "10",
    unitOfMeasure: formData.get("unitOfMeasure") as string || "UNIT",
    customUnitName: formData.get("customUnitName") as string || undefined,
    initialStock: formData.get("initialStock") as string || "0",
    initialLocationId: formData.get("initialLocationId") as string || undefined,
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

  if (result.data.unitOfMeasure === "OTHER" && !result.data.customUnitName) {
    return { success: false, error: "Indicá la unidad personalizada" }
  }

  if (result.data.initialStock > 0 && !result.data.initialLocationId) {
    return { success: false, error: "Seleccioná una sucursal para el stock inicial" }
  }

  // Check for duplicate barcode
  if (result.data.barcode) {
    const existingBarcode = await db.product.findUnique({
      where: { barcode: result.data.barcode },
    })
    if (existingBarcode) {
      return { success: false, error: "Ya existe un producto con ese código de barras" }
    }
  }

  try {
    const session = await auth()
    const userId = session?.user ? await resolveSessionUserId(session) : null

    const product = await prisma.$transaction(async (tx) => {
      const txDb = tx as any
      const created = await txDb.product.create({
        data: {
          name: result.data.name,
          slug,
          description: result.data.description || null,
          price: result.data.price,
          cost: result.data.cost || null,
          barcode: result.data.barcode || null,
          image: result.data.image || null,
          lowStockThreshold: result.data.lowStockThreshold,
          unitOfMeasure: result.data.unitOfMeasure,
          customUnitName: result.data.unitOfMeasure === "OTHER" ? result.data.customUnitName || null : null,
          categoryId: result.data.categoryId || null,
        },
        include: {
          category: true,
        },
      })

      if (result.data.initialStock > 0 && result.data.initialLocationId) {
        await applyInventoryMovement(txDb, {
          productId: created.id,
          locationId: result.data.initialLocationId,
          quantityDelta: result.data.initialStock,
          type: "INITIAL",
          userId,
          notes: "Stock inicial del producto",
        })
      }

      return created
    })

    revalidatePath("/products")
    return {
      success: true,
      data: {
        ...serializeProduct(product),
      },
    }
  } catch (error) {
    console.error("Error creating product:", error)
    return { success: false, error: "Error al crear producto" }
  }
}

export async function createProductForPurchaseOrder(input: {
  name: string
  price?: number
  cost: number
  barcode?: string
  unitOfMeasure?: "UNIT" | "ML" | "G" | "KG" | "LT" | "OTHER"
  customUnitName?: string
  supplierId?: string
}): Promise<ActionResult<ProductData>> {
  const result = purchaseOrderProductSchema.safeParse(input)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || result.error.flatten().fieldErrors.cost?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  if (result.data.unitOfMeasure === "OTHER" && !result.data.customUnitName) {
    return { success: false, error: "Indicá la unidad personalizada" }
  }

  if (result.data.barcode) {
    const existingBarcode = await db.product.findUnique({
      where: { barcode: result.data.barcode },
    })
    if (existingBarcode) {
      return { success: false, error: "Ya existe un producto con ese código de barras" }
    }
  }

  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "No autenticado" }
    }

    if (!PURCHASE_PRODUCT_ROLES.has((session.user as any).role || "")) {
      return { success: false, error: "No autorizado" }
    }

    const product = await db.product.create({
      data: {
        name: result.data.name,
        slug: slugify(result.data.name),
        price: result.data.price ?? 0,
        cost: result.data.cost,
        barcode: result.data.barcode || null,
        unitOfMeasure: result.data.unitOfMeasure,
        customUnitName: result.data.unitOfMeasure === "OTHER" ? result.data.customUnitName || null : null,
        supplierId: result.data.supplierId || null,
      },
      include: {
        category: true,
      },
    })

    revalidatePath("/products")
    revalidatePath("/purchase-orders")
    return {
      success: true,
      data: {
        ...serializeProduct(product),
      },
    }
  } catch (error) {
    console.error("Error creating purchase-order product:", error)
    return { success: false, error: "Error al crear producto para la compra" }
  }
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult<ProductData>> {
  const rawData = {
    name: formData.get("name") as string,
    description: formData.get("description") as string || undefined,
    price: formData.get("price") as string,
    cost: formData.get("cost") as string || undefined,
    barcode: formData.get("barcode") as string || undefined,
    image: formData.get("image") as string || undefined,
    lowStockThreshold: formData.get("lowStockThreshold") as string || "10",
    unitOfMeasure: formData.get("unitOfMeasure") as string || "UNIT",
    customUnitName: formData.get("customUnitName") as string || undefined,
    initialStock: "0",
    initialLocationId: undefined,
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

  if (result.data.unitOfMeasure === "OTHER" && !result.data.customUnitName) {
    return { success: false, error: "Indicá la unidad personalizada" }
  }

  // Check for duplicate barcode (excluding current product)
  if (result.data.barcode) {
    const existingBarcode = await db.product.findFirst({
      where: { barcode: result.data.barcode, id: { not: id } },
    })
    if (existingBarcode) {
      return { success: false, error: "Ya existe un producto con ese código de barras" }
    }
  }

  try {
    const product = await db.product.update({
      where: { id },
        data: {
        name: result.data.name,
        slug,
        description: result.data.description || null,
        price: result.data.price,
        cost: result.data.cost || null,
        barcode: result.data.barcode || null,
        image: result.data.image || null,
        lowStockThreshold: result.data.lowStockThreshold,
        unitOfMeasure: result.data.unitOfMeasure,
        customUnitName: result.data.unitOfMeasure === "OTHER" ? result.data.customUnitName || null : null,
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
        ...serializeProduct(product),
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
    await db.product.update({
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
