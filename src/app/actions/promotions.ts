"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getActivePromotionsData } from "@/lib/promotion-data"

const db = prisma as any

const comboItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const scaleTierSchema = z.object({
  minimumQuantity: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
})

const promotionSchema = z.discriminatedUnion("type", [
  z.object({
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    type: z.literal("COMBO"),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    comboPrice: z.number().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    comboItems: z.array(comboItemSchema).min(2, "El combo necesita al menos 2 productos"),
  }),
  z.object({
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    type: z.literal("SCALE"),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    productId: z.string().min(1),
    tiers: z.array(scaleTierSchema).min(1, "Definí al menos un escalón"),
  }),
])

export async function getPromotions() {
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

  return promotions.map((promotion: any) => ({
    ...promotion,
    comboPrice: promotion.comboPrice ? Number(promotion.comboPrice) : null,
    discountPercent: promotion.discountPercent ? Number(promotion.discountPercent) : null,
    discountAmount: promotion.discountAmount ? Number(promotion.discountAmount) : null,
    tiers: promotion.tiers.map((tier: any) => ({
      ...tier,
      discountPercent: tier.discountPercent ? Number(tier.discountPercent) : null,
      discountAmount: tier.discountAmount ? Number(tier.discountAmount) : null,
    })),
  }))
}

export async function getActivePromotions() {
  return getActivePromotionsData()
}

export async function createPromotion(input: unknown) {
  try {
    const parsed = promotionSchema.parse(input)

    if (parsed.type === "COMBO") {
      const uniqueProducts = Array.from(new Set(parsed.comboItems.map((item) => item.productId)))

      await db.promotion.create({
        data: {
          name: parsed.name,
          description: parsed.description || null,
          type: parsed.type,
          startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
          endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
          comboPrice: parsed.comboPrice || null,
          discountPercent: parsed.discountPercent || null,
          discountAmount: parsed.discountAmount || null,
          products: {
            create: uniqueProducts.map((productId) => ({ productId })),
          },
          comboItems: {
            create: parsed.comboItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      })
    } else {
      await db.promotion.create({
        data: {
          name: parsed.name,
          description: parsed.description || null,
          type: parsed.type,
          startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
          endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
          products: {
            create: [{ productId: parsed.productId }],
          },
          tiers: {
            create: parsed.tiers.map((tier) => ({
              productId: parsed.productId,
              minimumQuantity: tier.minimumQuantity,
              discountPercent: tier.discountPercent || null,
              discountAmount: tier.discountAmount || null,
            })),
          },
        },
      })
    }

    revalidatePath("/promotions")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear promoción" }
  }
}
