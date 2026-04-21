"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult } from "@/types/auth"

const locationSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
})

export async function getLocations(): Promise<ActionResult<any[]>> {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { inventory: true, sales: true },
        },
      },
    })
    return { success: true, data: locations }
  } catch (error) {
    console.error("Error fetching locations:", error)
    return { success: false, error: "Error al obtener sucursales" }
  }
}

export async function getLocation(id: string): Promise<ActionResult<any>> {
  try {
    const location = await prisma.location.findUnique({
      where: { id },
    })
    if (!location) {
      return { success: false, error: "Sucursal no encontrada" }
    }
    return { success: true, data: location }
  } catch (error) {
    console.error("Error fetching location:", error)
    return { success: false, error: "Error al obtener sucursal" }
  }
}

export async function createLocation(
  formData: FormData
): Promise<ActionResult<any>> {
  const name = formData.get("name") as string
  const address = formData.get("address") as string | null
  const phone = formData.get("phone") as string | null

  const result = locationSchema.safeParse({ name, address, phone })

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  try {
    const location = await prisma.location.create({
      data: result.data,
    })
    revalidatePath("/locations")
    return { success: true, data: location }
  } catch (error) {
    console.error("Error creating location:", error)
    return { success: false, error: "Error al crear sucursal" }
  }
}

export async function updateLocation(
  id: string,
  formData: FormData
): Promise<ActionResult<any>> {
  const name = formData.get("name") as string
  const address = formData.get("address") as string | null
  const phone = formData.get("phone") as string | null

  const result = locationSchema.safeParse({ name, address, phone })

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.name?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  try {
    const location = await prisma.location.update({
      where: { id },
      data: result.data,
    })
    revalidatePath("/locations")
    return { success: true, data: location }
  } catch (error) {
    console.error("Error updating location:", error)
    return { success: false, error: "Error al actualizar sucursal" }
  }
}

export async function deleteLocation(
  id: string,
  userRole: string
): Promise<ActionResult<void>> {
  if (userRole !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden eliminar" }
  }

  try {
    // Soft delete - set isActive to false
    await prisma.location.update({
      where: { id },
      data: { isActive: false },
    })
    revalidatePath("/locations")
    return { success: true }
  } catch (error) {
    console.error("Error deleting location:", error)
    return { success: false, error: "Error al eliminar sucursal" }
  }
}
