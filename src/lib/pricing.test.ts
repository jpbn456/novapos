import { describe, expect, test } from "vitest"

import {
  calculatePromotionalPricing,
  type PricingItemInput,
  type PromotionPricingInput,
} from "./pricing"

function buildComboPromotion(
  overrides: Partial<PromotionPricingInput> = {}
): PromotionPricingInput {
  return {
    id: overrides.id ?? "promo-1",
    name: overrides.name ?? "Promo combo",
    type: "COMBO",
    comboPrice: overrides.comboPrice,
    discountPercent: overrides.discountPercent,
    discountAmount: overrides.discountAmount,
    comboItems: overrides.comboItems,
    groups: overrides.groups,
    tiers: [],
    products: overrides.products ?? [],
  }
}

describe("calculatePromotionalPricing with groups", () => {
  const testCases: Array<{
    name: string
    items: PricingItemInput[]
    promotions: PromotionPricingInput[]
    expected: {
      total: number
      savings: number
      lineSavings?: Record<string, number>
      appliedPromotions?: number
    }
  }> = [
    {
      name: "mandatory group applies discount",
      items: [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
      ],
      promotions: [
        buildComboPromotion({
          comboPrice: 25,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 2,
              options: [
                { productId: "a", quantity: 1 },
                { productId: "b", quantity: 1 },
              ],
            },
          ],
        }),
      ],
      expected: {
        total: 25,
        savings: 5,
      },
    },
    {
      name: "mixed groups pick the optimal eligible option",
      items: [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
        { productId: "c", quantity: 1, unitPrice: 30 },
      ],
      promotions: [
        buildComboPromotion({
          comboPrice: 30,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELIGIBLE",
              requiredQuantity: 1,
              options: [
                { productId: "b", quantity: 1 },
                { productId: "c", quantity: 1 },
              ],
            },
          ],
        }),
      ],
      expected: {
        total: 50,
        savings: 10,
        lineSavings: { a: 2.5, b: 0, c: 7.5 },
      },
    },
    {
      name: "insufficient eligible selection yields no discount",
      items: [{ productId: "b", quantity: 1, unitPrice: 20 }],
      promotions: [
        buildComboPromotion({
          comboPrice: 15,
          groups: [
            {
              type: "ELIGIBLE",
              requiredQuantity: 2,
              options: [
                { productId: "b", quantity: 1 },
                { productId: "c", quantity: 1 },
              ],
            },
          ],
        }),
      ],
      expected: {
        total: 20,
        savings: 0,
        appliedPromotions: 0,
      },
    },
    {
      name: "same product can be consumed across multiple groups with correct bundle count",
      items: [{ productId: "a", quantity: 4, unitPrice: 10 }],
      promotions: [
        buildComboPromotion({
          comboPrice: 15,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELIGIBLE",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
          ],
        }),
      ],
      expected: {
        total: 30,
        savings: 10,
        lineSavings: { a: 10 },
      },
    },
    {
      name: "legacy comboItems fallback behaves as a mandatory group",
      items: [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
      ],
      promotions: [
        buildComboPromotion({
          comboPrice: 25,
          comboItems: [
            { productId: "a", quantity: 1 },
            { productId: "b", quantity: 1 },
          ],
        }),
      ],
      expected: {
        total: 25,
        savings: 5,
      },
    },
    {
      name: "tie-breaking prefers the lower bundle price deterministically",
      items: [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
        { productId: "c", quantity: 1, unitPrice: 30 },
      ],
      promotions: [
        buildComboPromotion({
          discountAmount: 5,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELIGIBLE",
              requiredQuantity: 1,
              options: [
                { productId: "b", quantity: 1 },
                { productId: "c", quantity: 1 },
              ],
            },
          ],
        }),
      ],
      expected: {
        total: 55,
        savings: 5,
        lineSavings: { a: 1.67, b: 3.33, c: 0 },
      },
    },
    {
      name: "items without active promotions keep original total",
      items: [{ productId: "a", quantity: 1, unitPrice: 10 }],
      promotions: [
        buildComboPromotion({
          comboPrice: 5,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 1,
              options: [{ productId: "b", quantity: 1 }],
            },
          ],
        }),
      ],
      expected: {
        total: 10,
        savings: 0,
        appliedPromotions: 0,
      },
    },
    {
      name: "multiple bundles apply when cart has enough quantity",
      items: [
        { productId: "a", quantity: 2, unitPrice: 10 },
        { productId: "b", quantity: 2, unitPrice: 20 },
      ],
      promotions: [
        buildComboPromotion({
          comboPrice: 25,
          groups: [
            {
              type: "MANDATORY",
              requiredQuantity: 2,
              options: [
                { productId: "a", quantity: 1 },
                { productId: "b", quantity: 1 },
              ],
            },
          ],
        }),
      ],
      expected: {
        total: 50,
        savings: 10,
        lineSavings: { a: 3.33, b: 6.67 },
      },
    },
  ]

  test.each(testCases)("$name", ({ items, promotions, expected }: (typeof testCases)[number]) => {
    const result = calculatePromotionalPricing(items, promotions)

    expect(result.total).toBe(expected.total)
    expect(result.savings).toBe(expected.savings)

    if (expected.appliedPromotions != null) {
      expect(result.appliedPromotions).toHaveLength(expected.appliedPromotions)
    }

    if (expected.lineSavings) {
      for (const [productId, savings] of Object.entries(expected.lineSavings)) {
        const line = result.lines.find((entry) => entry.productId === productId)

        expect(line?.savings).toBeCloseTo(savings, 2)
      }
    }
  })
})
