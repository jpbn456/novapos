"use server"

import { auth } from "@/auth"
import { resolveSessionUserId } from "@/lib/auth/session-user"
import { applyInventoryMovement } from "@/lib/inventory"
import { prisma } from "@/lib/prisma"
import { roundQuantity } from "@/lib/quantity"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const db = prisma as any
const MANAGER_ROLES = new Set(["ADMIN", "MANAGER"])

const manualInventoryMovementSchema = z.object({
  productId: z.string().min(1, "Producto requerido"),
  locationId: z.string().min(1, "Sucursal requerida"),
  type: z.enum(["MANUAL_IN", "MANUAL_OUT"]),
  quantity: z.number().positive("La cantidad debe ser positiva"),
  notes: z.string().min(3, "Indicá un motivo").max(500, "Motivo demasiado largo"),
})

export async function getInventoryMovements(locationId?: string, limit = 100) {
  const movements = await db.inventoryMovement.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          productNumber: true,
          name: true,
          unitOfMeasure: true,
          customUnitName: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return movements.map((movement: any) => ({
    ...movement,
    quantityDelta: roundQuantity(Number(movement.quantityDelta)),
    quantityBefore: roundQuantity(Number(movement.quantityBefore)),
    quantityAfter: roundQuantity(Number(movement.quantityAfter)),
    product: {
      ...movement.product,
      customUnitName: movement.product.customUnitName || null,
    },
  }))
}

export async function createManualInventoryMovement(input: unknown) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "No autenticado" }
    }

    if (!MANAGER_ROLES.has((session.user as any).role || "")) {
      return { success: false, error: "No autorizado" }
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." }
    }

    const parsed = manualInventoryMovementSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().formErrors[0] || Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] || "Datos inválidos",
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    await prisma.$transaction(async (tx) => {
      const quantityDelta = parsed.data.type === "MANUAL_IN" ? parsed.data.quantity : -parsed.data.quantity

      await applyInventoryMovement(tx as any, {
        productId: parsed.data.productId,
        locationId: parsed.data.locationId,
        quantityDelta,
        type: parsed.data.type,
        userId,
        notes: parsed.data.notes,
      })
    })

    revalidatePath("/inventory-movements")
    revalidatePath("/reports")

    return { success: true }
  } catch (error: any) {
    console.error("Error creating manual inventory movement:", error)
    return {
      success: false,
      error: error.message || "Error al registrar movimiento manual",
    }
  }
}
