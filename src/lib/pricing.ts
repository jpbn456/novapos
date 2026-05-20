export type PromotionPricingInput = {
  id: string
  name: string
  type: "COMBO" | "SCALE"
  comboPrice?: number | null
  discountPercent?: number | null
  discountAmount?: number | null
  comboItems: Array<{
    productId: string
    quantity: number
  }>
  tiers: Array<{
    productId?: string | null
    minimumQuantity: number
    discountPercent?: number | null
    discountAmount?: number | null
  }>
  products: Array<{
    productId: string
  }>
}

export type PricingItemInput = {
  productId: string
  quantity: number
  unitPrice: number
  name?: string
}

export type AppliedPromotionSummary = {
  promotionId: string
  promotionName: string
  type: "COMBO" | "SCALE"
  discount: number
}

export type PricingLine = {
  productId: string
  quantity: number
  baseUnitPrice: number
  effectiveUnitPrice: number
  originalSubtotal: number
  discountedSubtotal: number
  savings: number
  appliedPromotions: AppliedPromotionSummary[]
}

export type PricingResult = {
  lines: PricingLine[]
  subtotal: number
  total: number
  savings: number
  appliedPromotions: AppliedPromotionSummary[]
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculatePromotionalPricing(
  items: PricingItemInput[],
  promotions: PromotionPricingInput[]
): PricingResult {
  const baseLines = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    baseUnitPrice: item.unitPrice,
    originalSubtotal: roundCurrency(item.unitPrice * item.quantity),
    discountedSubtotal: roundCurrency(item.unitPrice * item.quantity),
    savings: 0,
    appliedPromotions: [] as AppliedPromotionSummary[],
  }))

  const lineMap = new Map(baseLines.map((line) => [line.productId, line]))
  const consumedForCombos = new Map<string, number>()
  const appliedPromotions: AppliedPromotionSummary[] = []

  const comboPromotions = promotions.filter((promotion) => promotion.type === "COMBO")
  for (const promotion of comboPromotions) {
    if (!promotion.comboItems.length) continue

    let bundleCount = Number.POSITIVE_INFINITY
    for (const comboItem of promotion.comboItems) {
      const line = lineMap.get(comboItem.productId)
      if (!line) {
        bundleCount = 0
        break
      }

      const availableQuantity = line.quantity - (consumedForCombos.get(comboItem.productId) || 0)
      bundleCount = Math.min(bundleCount, Math.floor(availableQuantity / comboItem.quantity))
    }

    if (!Number.isFinite(bundleCount) || bundleCount <= 0) continue

    const bundleBaseTotal = roundCurrency(
      promotion.comboItems.reduce((sum, comboItem) => {
        const line = lineMap.get(comboItem.productId)
        return sum + (line ? line.baseUnitPrice * comboItem.quantity : 0)
      }, 0)
    )

    let bundleDiscount = 0
    if (promotion.comboPrice != null) {
      bundleDiscount = Math.max(bundleBaseTotal - promotion.comboPrice, 0)
    } else if (promotion.discountPercent != null) {
      bundleDiscount = bundleBaseTotal * (promotion.discountPercent / 100)
    } else if (promotion.discountAmount != null) {
      bundleDiscount = promotion.discountAmount
    }

    bundleDiscount = roundCurrency(bundleDiscount)
    if (bundleDiscount <= 0) continue

    const totalDiscount = roundCurrency(bundleDiscount * bundleCount)
    let allocatedDiscount = 0

    promotion.comboItems.forEach((comboItem, index) => {
      const line = lineMap.get(comboItem.productId)
      if (!line) return

      const bundleContribution = line.baseUnitPrice * comboItem.quantity * bundleCount
      const lineDiscount = index === promotion.comboItems.length - 1
        ? roundCurrency(totalDiscount - allocatedDiscount)
        : roundCurrency(totalDiscount * (bundleContribution / (bundleBaseTotal * bundleCount)))

      allocatedDiscount = roundCurrency(allocatedDiscount + lineDiscount)
      line.discountedSubtotal = roundCurrency(line.discountedSubtotal - lineDiscount)
      line.savings = roundCurrency(line.savings + lineDiscount)
      line.appliedPromotions.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        type: "COMBO",
        discount: lineDiscount,
      })
      consumedForCombos.set(comboItem.productId, (consumedForCombos.get(comboItem.productId) || 0) + comboItem.quantity * bundleCount)
    })

    appliedPromotions.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      type: "COMBO",
      discount: totalDiscount,
    })
  }

  const scalePromotions = promotions.filter((promotion) => promotion.type === "SCALE")
  for (const line of baseLines) {
    const remainingQuantity = line.quantity - (consumedForCombos.get(line.productId) || 0)
    if (remainingQuantity <= 0) continue

    const matchingPromotions = scalePromotions.filter((promotion) =>
      promotion.products.some((product) => product.productId === line.productId)
    )

    let bestDiscount = 0
    let bestPromotion: PromotionPricingInput | null = null

    for (const promotion of matchingPromotions) {
      const applicableTier = [...promotion.tiers]
        .filter((tier) => (tier.productId ? tier.productId === line.productId : true) && tier.minimumQuantity <= remainingQuantity)
        .sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0]

      if (!applicableTier) continue

      const remainingSubtotal = line.baseUnitPrice * remainingQuantity
      const tierDiscount = applicableTier.discountPercent != null
        ? remainingSubtotal * (applicableTier.discountPercent / 100)
        : (applicableTier.discountAmount || 0)

      if (tierDiscount > bestDiscount) {
        bestDiscount = tierDiscount
        bestPromotion = promotion
      }
    }

    if (bestPromotion && bestDiscount > 0) {
      const discount = roundCurrency(Math.min(bestDiscount, line.discountedSubtotal))
      line.discountedSubtotal = roundCurrency(line.discountedSubtotal - discount)
      line.savings = roundCurrency(line.savings + discount)
      line.appliedPromotions.push({
        promotionId: bestPromotion.id,
        promotionName: bestPromotion.name,
        type: "SCALE",
        discount,
      })
      appliedPromotions.push({
        promotionId: bestPromotion.id,
        promotionName: bestPromotion.name,
        type: "SCALE",
        discount,
      })
    }
  }

  const lines: PricingLine[] = baseLines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    baseUnitPrice: line.baseUnitPrice,
    effectiveUnitPrice: roundCurrency(line.discountedSubtotal / line.quantity),
    originalSubtotal: line.originalSubtotal,
    discountedSubtotal: line.discountedSubtotal,
    savings: line.savings,
    appliedPromotions: line.appliedPromotions,
  }))

  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.discountedSubtotal, 0))
  const savings = roundCurrency(lines.reduce((sum, line) => sum + line.savings, 0))

  return {
    lines,
    subtotal,
    total: subtotal,
    savings,
    appliedPromotions,
  }
}
