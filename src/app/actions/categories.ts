"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult } from "@/types/auth"

const categorySchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  slug: z.string().min(1).max(100),
  parentId: z.string().optional(),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
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

export async function getCategory(id: string): Promise<ActionResult<any>> {
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    })
    if (!category) {
      return { success: false, error: "Categoría no encontrada" }
    }
    return { success: true, data: category }
  } catch (error) {
    console.error("Error fetching category:", error)
    return { success: false, error: "Error al obtener categoría" }
  }
}

export async function createCategory(
  formData: FormData
): Promise<ActionResult<any>> {
  const name = formData.get("name") as string
  const parentId = formData.get("parentId") as string | null
  const slug = slugify(name)

  // Convert "none" to null
  const filteredParentId = parentId === "none" ? null : parentId

  const result = categorySchema.safeParse({ name, slug, parentId: filteredParentId || undefined })

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  // Check for duplicate slug
  const existing = await prisma.category.findUnique({
    where: { slug },
  })

  if (existing) {
    return { success: false, error: "Ya existe una categoría con ese nombre" }
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: result.data.name,
        slug: result.data.slug,
        parentId: filteredParentId,
      },
    })
    revalidatePath("/categories")
    return { success: true, data: category }
  } catch (error) {
    console.error("Error creating category:", error)
    return { success: false, error: "Error al crear categoría" }
  }
}

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<ActionResult<any>> {
  const name = formData.get("name") as string
  const parentId = formData.get("parentId") as string | null
  const slug = slugify(name)

  // Convert "none" to null
  const filteredParentId = parentId === "none" ? null : parentId

  const result = categorySchema.safeParse({ name, slug, parentId: filteredParentId || undefined })

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  // Check for duplicate slug (excluding current category)
  const existing = await prisma.category.findFirst({
    where: {
      slug,
      id: { not: id },
    },
  })

  if (existing) {
    return { success: false, error: "Ya existe una categoría con ese nombre" }
  }

  // Prevent setting itself as parent
  if (filteredParentId === id) {
    return { success: false, error: "Una categoría no puede ser padre de sí misma" }
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: result.data.name,
        slug: result.data.slug,
        parentId: filteredParentId,
      },
    })
    revalidatePath("/categories")
    return { success: true, data: category }
  } catch (error) {
    console.error("Error updating category:", error)
    return { success: false, error: "Error al actualizar categoría" }
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<void>> {
  try {
    // Set products' categoryId to null instead of deleting
    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    })

    // Delete the category
    await prisma.category.delete({
      where: { id },
    })

    revalidatePath("/categories")
    return { success: true }
  } catch (error) {
    console.error("Error deleting category:", error)
    return { success: false, error: "Error al eliminar categoría" }
  }
}
