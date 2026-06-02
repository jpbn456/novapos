"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getActivePromotionsData } from "@/lib/promotion-data"

const db = prisma as any
const MANAGER_ROLES = new Set(["ADMIN", "MANAGER"])

const comboItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const scaleTierSchema = z
  .object({
    minimumQuantity: z.number().int().positive(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
  })
  .superRefine((tier, ctx) => {
    const hasPercent = (tier.discountPercent || 0) > 0
    const hasAmount = (tier.discountAmount || 0) > 0

    if (hasPercent === hasAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cada escalón debe tener o descuento % o descuento fijo, pero no ambos",
      })
    }
  })

const comboPromotionBaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  type: z.literal("COMBO"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  comboPrice: z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  comboItems: z.array(comboItemSchema).min(2, "El combo necesita al menos 2 productos"),
})

const comboPromotionSchema = comboPromotionBaseSchema
  .superRefine((promotion, ctx) => {
    const hasPrice = (promotion.comboPrice || 0) > 0
    const hasPercent = (promotion.discountPercent || 0) > 0
    const hasAmount = (promotion.discountAmount || 0) > 0
    const activeStrategies = [hasPrice, hasPercent, hasAmount].filter(Boolean).length

    if (activeStrategies !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El combo debe tener una única estrategia de descuento: precio, porcentaje o monto fijo",
      })
    }

    const productIds = promotion.comboItems.map((item) => item.productId)
    if (new Set(productIds).size !== productIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No repitas productos dentro del combo",
      })
    }
  })

const scalePromotionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  type: z.literal("SCALE"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  productId: z.string().min(1),
  tiers: z.array(scaleTierSchema).min(1, "Definí al menos un escalón"),
})

const promotionSchema = z.union([comboPromotionSchema, scalePromotionSchema])
type PromotionInput = z.infer<typeof comboPromotionBaseSchema> | z.infer<typeof scalePromotionSchema>

async function ensurePromotionAccess() {
  const session = await auth()

  if (!session?.user) {
    throw new Error("No autenticado")
  }

  if (!MANAGER_ROLES.has((session.user as any).role || "")) {
    throw new Error("No autorizado")
  }
}

function toPromotionDates(parsed: { startsAt?: string; endsAt?: string }) {
  return {
    startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
    endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
  }
}

function mapPromotionRecord(promotion: any) {
  return {
    ...promotion,
    comboPrice: promotion.comboPrice ? Number(promotion.comboPrice) : null,
    discountPercent: promotion.discountPercent ? Number(promotion.discountPercent) : null,
    discountAmount: promotion.discountAmount ? Number(promotion.discountAmount) : null,
    tiers: promotion.tiers.map((tier: any) => ({
      ...tier,
      discountPercent: tier.discountPercent ? Number(tier.discountPercent) : null,
      discountAmount: tier.discountAmount ? Number(tier.discountAmount) : null,
    })),
  }
}

function buildPromotionMutationData(parsed: PromotionInput) {
  const commonData = {
    name: parsed.name,
    description: parsed.description || null,
    ...toPromotionDates(parsed),
  }

  if (parsed.type === "COMBO") {
    const uniqueProducts = Array.from(new Set(parsed.comboItems.map((item: z.infer<typeof comboItemSchema>) => item.productId)))

    return {
      ...commonData,
      type: parsed.type,
      comboPrice: parsed.comboPrice || null,
      discountPercent: parsed.discountPercent || null,
      discountAmount: parsed.discountAmount || null,
      products: {
        create: uniqueProducts.map((productId) => ({ productId })),
      },
      comboItems: {
        create: parsed.comboItems.map((item: z.infer<typeof comboItemSchema>) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      tiers: {
        create: [],
      },
    }
  }

  return {
    ...commonData,
    type: parsed.type,
    comboPrice: null,
    discountPercent: null,
    discountAmount: null,
    products: {
      create: [{ productId: parsed.productId }],
    },
    comboItems: {
      create: [],
    },
    tiers: {
      create: parsed.tiers.map((tier: z.infer<typeof scaleTierSchema>) => ({
        productId: parsed.productId,
        minimumQuantity: tier.minimumQuantity,
        discountPercent: tier.discountPercent || null,
        discountAmount: tier.discountAmount || null,
      })),
    },
  }
}

function revalidatePromotionPaths() {
  revalidatePath("/promotions")
  revalidatePath("/pos")
}

export async function getPromotions() {
  await ensurePromotionAccess()

  const promotions = await db.promotion.findMany({
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              productNumber: true,
              name: true,
            },
          },
        },
      },
      comboItems: {
        include: {
          product: {
            select: {
              id: true,
              productNumber: true,
              name: true,
            },
          },
        },
      },
      tiers: {
        include: {
          product: {
            select: {
              id: true,
              productNumber: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return promotions.map(mapPromotionRecord)
}

export async function getActivePromotions() {
  return getActivePromotionsData()
}

export async function createPromotion(input: unknown) {
  try {
    await ensurePromotionAccess()
    const parsed = promotionSchema.parse(input)

    await db.promotion.create({
      data: buildPromotionMutationData(parsed),
    })

    revalidatePromotionPaths()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear promoción" }
  }
}

export async function updatePromotion(id: string, input: unknown) {
  try {
    await ensurePromotionAccess()
    const parsed = promotionSchema.parse(input)

    const existingPromotion = await db.promotion.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingPromotion) {
      return { success: false, error: "Promoción no encontrada" }
    }

    const mutationData = buildPromotionMutationData(parsed)

    await db.promotion.update({
      where: { id },
      data: {
        name: mutationData.name,
        description: mutationData.description,
        type: mutationData.type,
        startsAt: mutationData.startsAt,
        endsAt: mutationData.endsAt,
        comboPrice: mutationData.comboPrice,
        discountPercent: mutationData.discountPercent,
        discountAmount: mutationData.discountAmount,
        products: {
          deleteMany: {},
          create: mutationData.products.create,
        },
        comboItems: {
          deleteMany: {},
          create: mutationData.comboItems.create,
        },
        tiers: {
          deleteMany: {},
          create: mutationData.tiers.create,
        },
      },
    })

    revalidatePromotionPaths()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar promoción" }
  }
}

export async function togglePromotionActive(id: string) {
  try {
    await ensurePromotionAccess()

    const promotion = await db.promotion.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    })

    if (!promotion) {
      return { success: false, error: "Promoción no encontrada" }
    }

    await db.promotion.update({
      where: { id },
      data: { isActive: !promotion.isActive },
    })

    revalidatePromotionPaths()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cambiar estado de la promoción" }
  }
}

export async function deletePromotion(id: string) {
  try {
    await ensurePromotionAccess()

    const promotion = await db.promotion.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!promotion) {
      return { success: false, error: "Promoción no encontrada" }
    }

    await db.promotion.delete({
      where: { id },
    })

    revalidatePromotionPaths()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al eliminar promoción" }
  }
}
