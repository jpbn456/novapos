import { describe, expect, test } from "vitest"

import {
  calculatePromotionalPricing,
  type PricingItemInput,
  type PromotionPricingInput,
} from "./pricing"
import type { ForcedPromotionSelection } from "@/types/auth"

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
              type: "OBLIGATORIO",
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
              type: "OBLIGATORIO",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELEGIBLE",
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
              type: "ELEGIBLE",
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
              type: "OBLIGATORIO",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELEGIBLE",
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
              type: "OBLIGATORIO",
              requiredQuantity: 1,
              options: [{ productId: "a", quantity: 1 }],
            },
            {
              type: "ELEGIBLE",
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
              type: "OBLIGATORIO",
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
              type: "OBLIGATORIO",
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

  test("forced combo selection is applied before automatic promotions", () => {
    const promotions = [
      buildComboPromotion({
        id: "forced-promo",
        name: "Combo desayuno",
        comboPrice: 20,
        groups: [
          {
            id: "group-base",
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "a", quantity: 1 },
              { productId: "b", quantity: 1 },
            ],
          },
        ],
      }),
      buildComboPromotion({
        id: "auto-promo",
        name: "Combo premium",
        comboPrice: 15,
        groups: [
          {
            id: "group-auto",
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "a", quantity: 1 },
              { productId: "b", quantity: 1 },
            ],
          },
        ],
      }),
    ]

    const forcedPromotions: ForcedPromotionSelection[] = [
      {
        id: "bundle-1",
        promotionId: "forced-promo",
        promotionName: "Combo desayuno",
        type: "COMBO",
        groups: [{ groupId: "group-base", optionProductIds: ["a", "b"] }],
      },
    ]

    const result = calculatePromotionalPricing(
      [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
      ],
      promotions,
      { forcedPromotions }
    )

    expect(result.total).toBe(20)
    expect(result.appliedPromotions).toEqual([
      expect.objectContaining({ promotionId: "forced-promo", discount: 10 }),
    ])
  })

  test("invalid forced combo selection falls back to automatic best promotion", () => {
    const promotions = [
      buildComboPromotion({
        id: "forced-promo",
        name: "Combo desayuno",
        comboPrice: 20,
        groups: [
          {
            id: "group-base",
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "a", quantity: 1 },
              { productId: "b", quantity: 1 },
            ],
          },
        ],
      }),
      buildComboPromotion({
        id: "auto-promo",
        name: "Combo premium",
        comboPrice: 15,
        groups: [
          {
            id: "group-auto",
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "a", quantity: 1 },
              { productId: "b", quantity: 1 },
            ],
          },
        ],
      }),
    ]

    const forcedPromotions: ForcedPromotionSelection[] = [
      {
        id: "bundle-1",
        promotionId: "forced-promo",
        promotionName: "Combo desayuno",
        type: "COMBO",
        groups: [{ groupId: "group-base", optionProductIds: ["a"] }],
      },
    ]

    const result = calculatePromotionalPricing(
      [
        { productId: "a", quantity: 1, unitPrice: 10 },
        { productId: "b", quantity: 1, unitPrice: 20 },
      ],
      promotions,
      { forcedPromotions }
    )

    expect(result.total).toBe(15)
    expect(result.appliedPromotions).toEqual([
      expect.objectContaining({ promotionId: "auto-promo", discount: 15 }),
    ])
  })

  test("SCALE promotion applies per batch of minimum quantity", () => {
    const promotions: PromotionPricingInput[] = [
      {
        id: "scale-1",
        name: "10% desde 5un",
        type: "SCALE",
        comboPrice: null,
        discountPercent: null,
        discountAmount: null,
        products: [{ productId: "a" }],
        tiers: [
          { productId: "a", minimumQuantity: 5, discountPercent: 10, discountAmount: null },
        ],
      },
    ]

    const result = calculatePromotionalPricing([{ productId: "a", quantity: 10, unitPrice: 100 }], promotions)

    expect(result.savings).toBe(100) // 2 batches of 5 at 10% each = 10% of 10*100 = 100
    expect(result.appliedPromotions).toHaveLength(1)
    expect(result.appliedPromotions[0]).toMatchObject({ promotionId: "scale-1", type: "SCALE", discount: 100 })
    expect(result.lines[0].appliedPromotions).toHaveLength(1)
    expect(result.lines[0].savings).toBe(100)
  })

  test("SCALE promotion applies best available tier per batch", () => {
    const promotions: PromotionPricingInput[] = [
      {
        id: "scale-1",
        name: "2→5%, 5→10%",
        type: "SCALE",
        comboPrice: null,
        discountPercent: null,
        discountAmount: null,
        products: [{ productId: "a" }],
        tiers: [
          { productId: "a", minimumQuantity: 2, discountPercent: 5, discountAmount: null },
          { productId: "a", minimumQuantity: 5, discountPercent: 10, discountAmount: null },
        ],
      },
    ]

    const result = calculatePromotionalPricing([{ productId: "a", quantity: 7, unitPrice: 100 }], promotions)

    expect(result.savings).toBe(60) // batch 1: 5 at 10% = 50, batch 2: 2 at 5% = 10
    expect(result.appliedPromotions).toHaveLength(1)
    expect(result.appliedPromotions[0]).toMatchObject({ promotionId: "scale-1", type: "SCALE", discount: 60 })
  })

  test("SCALE promotion only applies when minimum quantity is met", () => {
    const promotions: PromotionPricingInput[] = [
      {
        id: "scale-1",
        name: "10% desde 5un",
        type: "SCALE",
        comboPrice: null,
        discountPercent: null,
        discountAmount: null,
        products: [{ productId: "a" }],
        tiers: [
          { productId: "a", minimumQuantity: 5, discountPercent: 10, discountAmount: null },
        ],
      },
    ]

    const result = calculatePromotionalPricing([{ productId: "a", quantity: 1, unitPrice: 100 }], promotions)

    expect(result.savings).toBe(0)
    expect(result.appliedPromotions).toHaveLength(0)
  })
})
