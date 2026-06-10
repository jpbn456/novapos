import type { ForcedPromotionSelection } from "@/types/auth"

export type PromotionPricingInput = {
  id: string
  name: string
  type: "COMBO" | "SCALE"
  comboPrice?: number | null
  discountPercent?: number | null
  discountAmount?: number | null
  comboItems?: Array<{
    productId: string
    quantity: number
  }>
  groups?: Array<{
    id?: string
    name?: string
    type: "OBLIGATORIO" | "ELEGIBLE"
    requiredQuantity: number
    options: Array<{
      productId: string
      quantity: number
    }>
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

type PricingOptions = {
  forcedPromotions?: ForcedPromotionSelection[]
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

type ResolvedComboGroup = {
  type: "OBLIGATORIO" | "ELEGIBLE"
  requiredQuantity: number
  options: Array<{
    productId: string
    quantity: number
  }>
}

type ResolvedComboSelection = {
  bundleCount: number
  bundleBaseTotal: number
  totalDiscount: number
  selectedOptions: Array<{
    productId: string
    quantity: number
  }>
}

function buildResolvedComboGroups(promotion: PromotionPricingInput): ResolvedComboGroup[] {
  if (promotion.groups?.length) {
    return promotion.groups.map((group) => ({
      type: group.type,
      requiredQuantity: group.requiredQuantity,
      options: group.options.map((option) => ({
        productId: option.productId,
        quantity: option.quantity,
      })),
    }))
  }

  if (promotion.comboItems?.length) {
    return [{
      type: "OBLIGATORIO",
      requiredQuantity: promotion.comboItems.length,
      options: promotion.comboItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }]
  }

  return []
}

function getCombinationIndices(length: number, choose: number): number[][] {
  if (choose <= 0 || choose > length) return []

  const combinations: number[][] = []
  const current: number[] = []

  function backtrack(start: number) {
    if (current.length === choose) {
      combinations.push([...current])
      return
    }

    for (let index = start; index <= length - (choose - current.length); index += 1) {
      current.push(index)
      backtrack(index + 1)
      current.pop()
    }
  }

  backtrack(0)
  return combinations
}

function calculateBundleDiscount(
  promotion: PromotionPricingInput,
  bundleBaseTotal: number
) {
  if (promotion.comboPrice != null) {
    return roundCurrency(Math.max(bundleBaseTotal - promotion.comboPrice, 0))
  }

  if (promotion.discountPercent != null) {
    return roundCurrency(bundleBaseTotal * (promotion.discountPercent / 100))
  }

  if (promotion.discountAmount != null) {
    return roundCurrency(Math.min(promotion.discountAmount, bundleBaseTotal))
  }

  return 0
}

function buildSelectionCandidate(
  promotion: PromotionPricingInput,
  selectedGroups: Array<Array<{ productId: string; quantity: number }>>,
  lineMap: Map<string, {
    productId: string
    quantity: number
    baseUnitPrice: number
  }>,
  consumedForCombos: Map<string, number>
): ResolvedComboSelection | null {
  const aggregatedRequirements = new Map<string, number>()
  let bundleBaseTotal = 0

  for (const selectedOptions of selectedGroups) {
    for (const option of selectedOptions) {
      const line = lineMap.get(option.productId)
      if (!line) return null

      const availableQuantity = line.quantity - (consumedForCombos.get(option.productId) || 0)
      if (availableQuantity < option.quantity) return null

      aggregatedRequirements.set(
        option.productId,
        (aggregatedRequirements.get(option.productId) || 0) + option.quantity
      )
      bundleBaseTotal += line.baseUnitPrice * option.quantity
    }
  }

  let bundleCount = Number.POSITIVE_INFINITY
  for (const [productId, requiredQuantity] of aggregatedRequirements) {
    const line = lineMap.get(productId)
    if (!line) return null

    const availableQuantity = line.quantity - (consumedForCombos.get(productId) || 0)
    bundleCount = Math.min(bundleCount, Math.floor(availableQuantity / requiredQuantity))
  }

  if (!Number.isFinite(bundleCount) || bundleCount <= 0) return null

  const normalizedBundleBaseTotal = roundCurrency(bundleBaseTotal)
  const bundleDiscount = calculateBundleDiscount(promotion, normalizedBundleBaseTotal)
  if (bundleDiscount <= 0) return null

  return {
    bundleCount,
    bundleBaseTotal: normalizedBundleBaseTotal,
    totalDiscount: roundCurrency(bundleDiscount * bundleCount),
    selectedOptions: selectedGroups.flat(),
  }
}

function resolveForcedComboSelection(
  promotion: PromotionPricingInput,
  forcedPromotion: ForcedPromotionSelection,
  lineMap: Map<string, {
    productId: string
    quantity: number
    baseUnitPrice: number
  }>,
  consumedForCombos: Map<string, number>
): ResolvedComboSelection | null {
  if (promotion.type !== "COMBO") return null

  if (!promotion.groups?.length) {
    if (!promotion.comboItems?.length) return null

    return buildSelectionCandidate(
      promotion,
      [promotion.comboItems.map((item) => ({ productId: item.productId, quantity: item.quantity }))],
      lineMap,
      consumedForCombos
    )
  }

  const selectedGroups: Array<Array<{ productId: string; quantity: number }>> = []

  for (const [groupIndex, group] of promotion.groups.entries()) {
    const forcedGroup = forcedPromotion.groups.find((entry) =>
      (entry.groupId && group.id ? entry.groupId === group.id : false)
    ) || forcedPromotion.groups[groupIndex]

    if (!forcedGroup) return null

    if (group.type === "OBLIGATORIO") {
      const expectedIds = group.options.map((option) => option.productId).sort()
      const forcedIds = [...forcedGroup.optionProductIds].sort()
      if (expectedIds.length !== forcedIds.length || expectedIds.some((productId, index) => productId !== forcedIds[index])) {
        return null
      }

      selectedGroups.push(group.options.map((option) => ({
        productId: option.productId,
        quantity: option.quantity,
      })))
      continue
    }

    const selectedIdSet = new Set(forcedGroup.optionProductIds)
    if (selectedIdSet.size !== group.requiredQuantity || forcedGroup.optionProductIds.length !== group.requiredQuantity) {
      return null
    }

    const selectedOptions = group.options.filter((option) => selectedIdSet.has(option.productId))
    if (selectedOptions.length !== group.requiredQuantity) {
      return null
    }

    selectedGroups.push(selectedOptions.map((option) => ({
      productId: option.productId,
      quantity: option.quantity,
    })))
  }

  return buildSelectionCandidate(promotion, selectedGroups, lineMap, consumedForCombos)
}

function resolveBestComboSelection(
  promotion: PromotionPricingInput,
  lineMap: Map<string, {
    productId: string
    quantity: number
    baseUnitPrice: number
  }>,
  consumedForCombos: Map<string, number>
): ResolvedComboSelection | null {
  const groups = buildResolvedComboGroups(promotion)
  if (!groups.length) return null

  const selectionVariants = groups.map((group) => {
    if (group.type === "OBLIGATORIO") {
      return [group.options]
    }

    return getCombinationIndices(group.options.length, group.requiredQuantity).map((indices) =>
      indices.map((index) => group.options[index])
    )
  })

  if (selectionVariants.some((variants) => variants.length === 0)) {
    return null
  }

  let bestSelection: ResolvedComboSelection | null = null

  function evaluateSelection(selectedGroups: Array<Array<{ productId: string; quantity: number }>>) {
    const candidate = buildSelectionCandidate(promotion, selectedGroups, lineMap, consumedForCombos)
    if (!candidate) return

    if (
      !bestSelection ||
      candidate.totalDiscount > bestSelection.totalDiscount ||
      (candidate.totalDiscount === bestSelection.totalDiscount && candidate.bundleBaseTotal < bestSelection.bundleBaseTotal)
    ) {
      bestSelection = candidate
    }
  }

  function walk(groupIndex: number, selectedGroups: Array<Array<{ productId: string; quantity: number }>>) {
    if (groupIndex === selectionVariants.length) {
      evaluateSelection(selectedGroups)
      return
    }

    for (const variant of selectionVariants[groupIndex]) {
      selectedGroups.push(variant)
      walk(groupIndex + 1, selectedGroups)
      selectedGroups.pop()
    }
  }

  walk(0, [])
  return bestSelection
}

function allocateComboDiscount(
  lineMap: Map<string, {
    productId: string
    quantity: number
    baseUnitPrice: number
    discountedSubtotal: number
    savings: number
    appliedPromotions: AppliedPromotionSummary[]
  }>,
  consumedForCombos: Map<string, number>,
  promotion: PromotionPricingInput,
  selection: ResolvedComboSelection
) {
  const aggregatedSelections = new Map<string, number>()
  for (const option of selection.selectedOptions) {
    aggregatedSelections.set(option.productId, (aggregatedSelections.get(option.productId) || 0) + option.quantity)
  }

  const lineApplications = Array.from(aggregatedSelections.entries()).map(([productId, quantity]) => {
    const line = lineMap.get(productId)
    return {
      productId,
      quantity,
      line,
      subtotal: line ? line.baseUnitPrice * quantity * selection.bundleCount : 0,
    }
  }).filter((entry) => entry.line)

  let allocatedDiscount = 0

  lineApplications.forEach((entry, index) => {
    const line = entry.line!
    const lineDiscount = index === lineApplications.length - 1
      ? roundCurrency(selection.totalDiscount - allocatedDiscount)
      : roundCurrency(selection.totalDiscount * (entry.subtotal / (selection.bundleBaseTotal * selection.bundleCount)))

    allocatedDiscount = roundCurrency(allocatedDiscount + lineDiscount)
    line.discountedSubtotal = roundCurrency(line.discountedSubtotal - lineDiscount)
    line.savings = roundCurrency(line.savings + lineDiscount)
    line.appliedPromotions.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      type: "COMBO",
      discount: lineDiscount,
    })
    consumedForCombos.set(
      entry.productId,
      (consumedForCombos.get(entry.productId) || 0) + entry.quantity * selection.bundleCount
    )
  })
}

export function calculatePromotionalPricing(
  items: PricingItemInput[],
  promotions: PromotionPricingInput[],
  options: PricingOptions = {}
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

  const promotionsById = new Map(promotions.map((promotion) => [promotion.id, promotion]))
  for (const forcedPromotion of options.forcedPromotions || []) {
    const promotion = promotionsById.get(forcedPromotion.promotionId)
    if (!promotion || promotion.type !== "COMBO") continue

    const selection = resolveForcedComboSelection(promotion, forcedPromotion, lineMap, consumedForCombos)
    if (!selection) continue

    allocateComboDiscount(lineMap, consumedForCombos, promotion, selection)
    appliedPromotions.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      type: "COMBO",
      discount: selection.totalDiscount,
    })
  }

  const comboPromotions = promotions.filter((promotion) => promotion.type === "COMBO")
  while (comboPromotions.length > 0) {
    let bestComboCandidate: { promotion: PromotionPricingInput; selection: ResolvedComboSelection } | null = null

    for (const promotion of comboPromotions) {
      const selection = resolveBestComboSelection(promotion, lineMap, consumedForCombos)
      if (!selection) continue

      if (
        !bestComboCandidate ||
        selection.totalDiscount > bestComboCandidate.selection.totalDiscount ||
        (selection.totalDiscount === bestComboCandidate.selection.totalDiscount && selection.bundleBaseTotal < bestComboCandidate.selection.bundleBaseTotal)
      ) {
        bestComboCandidate = { promotion, selection }
      }
    }

    if (!bestComboCandidate) break

    allocateComboDiscount(lineMap, consumedForCombos, bestComboCandidate.promotion, bestComboCandidate.selection)

    appliedPromotions.push({
      promotionId: bestComboCandidate.promotion.id,
      promotionName: bestComboCandidate.promotion.name,
      type: "COMBO",
      discount: bestComboCandidate.selection.totalDiscount,
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
