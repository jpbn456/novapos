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
      groups: {
        include: {
          options: {
            include: {
              product: {
                select: {
                  id: true,
                  productNumber: true,
                  name: true,
                  price: true,
                  sku: true,
                  barcode: true,
                  unitOfMeasure: true,
                  customUnitName: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      tiers: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return promotions
    .filter((promotion: any) => isPromotionActive(promotion))
    .map((promotion: any) => {
      const groups = promotion.groups.map((group: any) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        requiredQuantity: group.requiredQuantity,
        sortOrder: group.sortOrder,
        options: group.options.map((option: any) => ({
          id: option.id,
          productId: option.productId,
          quantity: option.quantity,
          sortOrder: option.sortOrder,
          product: option.product
            ? {
                id: option.product.id,
                productNumber: option.product.productNumber,
                name: option.product.name,
                price: Number(option.product.price),
                sku: option.product.sku,
                barcode: option.product.barcode,
                unitOfMeasure: option.product.unitOfMeasure,
                customUnitName: option.product.customUnitName || null,
              }
            : null,
        })),
      }))

      const comboItems = promotion.comboItems.length
        ? promotion.comboItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        : groups
            .filter((group: any) => group.type === "MANDATORY")
            .flatMap((group: any) =>
              group.options.map((option: any) => ({
                productId: option.productId,
                quantity: option.quantity,
              }))
            )

      return {
        id: promotion.id,
        name: promotion.name,
        description: promotion.description || null,
        type: promotion.type,
        comboPrice: promotion.comboPrice ? Number(promotion.comboPrice) : null,
        discountPercent: promotion.discountPercent ? Number(promotion.discountPercent) : null,
        discountAmount: promotion.discountAmount ? Number(promotion.discountAmount) : null,
        products: promotion.products.map((product: any) => ({
          productId: product.productId,
        })),
        comboItems,
        groups,
        tiers: promotion.tiers.map((tier: any) => ({
          productId: tier.productId,
          minimumQuantity: tier.minimumQuantity,
          discountPercent: tier.discountPercent ? Number(tier.discountPercent) : null,
          discountAmount: tier.discountAmount ? Number(tier.discountAmount) : null,
        })),
      }
    })
}
