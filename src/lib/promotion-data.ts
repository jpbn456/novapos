import { prisma } from "@/lib/prisma"

const db = prisma as any

function isPromotionActive(promotion: any, now = new Date()) {
  if (!promotion.isActive) return false
  if (promotion.startsAt && new Date(promotion.startsAt) > now) return false
  if (promotion.endsAt && new Date(promotion.endsAt) < now) return false
  return true
}

export async function getActivePromotionsData() {
  const promotions = await db.promotion.findMany({
    include: {
      products: true,
      comboItems: true,
      tiers: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return promotions
    .filter((promotion: any) => isPromotionActive(promotion))
    .map((promotion: any) => ({
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      comboPrice: promotion.comboPrice ? Number(promotion.comboPrice) : null,
      discountPercent: promotion.discountPercent ? Number(promotion.discountPercent) : null,
      discountAmount: promotion.discountAmount ? Number(promotion.discountAmount) : null,
      products: promotion.products.map((product: any) => ({
        productId: product.productId,
      })),
      comboItems: promotion.comboItems.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      tiers: promotion.tiers.map((tier: any) => ({
        productId: tier.productId,
        minimumQuantity: tier.minimumQuantity,
        discountPercent: tier.discountPercent ? Number(tier.discountPercent) : null,
        discountAmount: tier.discountAmount ? Number(tier.discountAmount) : null,
      })),
    }))
}
