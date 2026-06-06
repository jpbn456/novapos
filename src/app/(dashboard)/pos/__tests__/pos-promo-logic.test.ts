import { describe, expect, test, vi } from "vitest"

// Mock server-side deps that the page file imports transitively
vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/promotion-data", () => ({ getActivePromotionsData: vi.fn() }))

import {
  buildPromotionCartItems,
  findPromotionProduct,
  formatGroupSummary,
  getGroupKey,
  type POSPromotion,
} from "../page"

function makeProduct(overrides: Partial<{ id: string; name: string; price: number; unitOfMeasure: string }> = {}) {
  return {
    id: overrides.id || "coffee",
    productNumber: 1,
    name: overrides.name || "Café",
    price: overrides.price ?? 500,
    sku: null,
    barcode: null,
    unitOfMeasure: "UNIT" as const,
    customUnitName: null,
  }
}

function makePromotion(overrides: Partial<POSPromotion> = {}): POSPromotion {
  return {
    id: "promo-1",
    name: "Combo desayuno",
    type: "COMBO",
    comboPrice: 800,
    discountPercent: null,
    discountAmount: null,
    comboItems: [],
    tiers: [],
    products: [],
    groups: [],
    ...overrides,
  }
}

describe("getGroupKey", () => {
  test("returns group id when available", () => {
    const group = { id: "group-42", type: "OBLIGATORIO" as const, requiredQuantity: 1, options: [] }
    expect(getGroupKey("promo-1", group, 0)).toBe("group-42")
  })

  test("falls back to promotionId-index when no group id", () => {
    const group = { type: "OBLIGATORIO" as const, requiredQuantity: 1, options: [] }
    expect(getGroupKey("promo-1", group, 2)).toBe("promo-1-2")
  })
})

describe("formatGroupSummary", () => {
  test("shows option count for mandatory group", () => {
    const group = { type: "OBLIGATORIO" as const, requiredQuantity: 2, options: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }] }
    expect(formatGroupSummary(group)).toBe("Grupo: incluye 2 opciones")
  })

  test("shows singular for one mandatory option", () => {
    const group = { type: "OBLIGATORIO" as const, requiredQuantity: 1, options: [{ productId: "a", quantity: 1 }] }
    expect(formatGroupSummary(group)).toBe("Grupo: incluye 1 opción")
  })

  test("shows required/total for eligible group", () => {
    const group = { type: "ELEGIBLE" as const, requiredQuantity: 2, options: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }, { productId: "c", quantity: 1 }] }
    expect(formatGroupSummary(group)).toBe("Grupo: elegí 2 de 3")
  })

  test("uses custom group name when provided", () => {
    const group = { name: "Bebidas", type: "ELEGIBLE" as const, requiredQuantity: 1, options: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }] }
    expect(formatGroupSummary(group)).toBe("Bebidas: elegí 1 de 2")
  })
})

describe("findPromotionProduct", () => {
  test("returns option.product when available", () => {
    const product = makeProduct()
    const option = { productId: "coffee", quantity: 1, product }
    const lookup = new Map()
    expect(findPromotionProduct(option, lookup)).toBe(product)
  })

  test("returns product from lookup map", () => {
    const product = makeProduct()
    const option = { productId: "coffee", quantity: 1 }
    const lookup = new Map([["coffee", product]])
    expect(findPromotionProduct(option, lookup)).toBe(product)
  })

  test("returns null when product not found", () => {
    const option = { productId: "unknown", quantity: 1 }
    const lookup = new Map()
    expect(findPromotionProduct(option, lookup)).toBeNull()
  })
})

describe("buildPromotionCartItems", () => {
  const productLookup = new Map([
    ["coffee", makeProduct({ id: "coffee", name: "Café", price: 500 })],
    ["toast", makeProduct({ id: "toast", name: "Tostado", price: 400 })],
    ["juice", makeProduct({ id: "juice", name: "Jugo", price: 300 })],
  ])

  describe("mandatory-only group", () => {
    test("builds cart items from mandatory group", () => {
      const promotion = makePromotion({
        groups: [
          {
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "coffee", quantity: 1 },
              { productId: "toast", quantity: 1 },
            ],
          },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {})

      expect(result.error).toBeUndefined()
      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toMatchObject({ productId: "coffee", name: "Café", quantity: 1 })
      expect(result.items[1]).toMatchObject({ productId: "toast", name: "Tostado", quantity: 1 })
    })

    test("returns error when product not found", () => {
      const promotion = makePromotion({
        groups: [
          {
            type: "OBLIGATORIO",
            requiredQuantity: 1,
            options: [{ productId: "unknown", quantity: 1 }],
          },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {})
      expect(result.error).toBe("Falta información del producto para Combo desayuno.")
      expect(result.items).toHaveLength(0)
    })
  })

  describe("eligible group", () => {
    test("builds items with complete eligible selections (adds selected options only)", () => {
      const promotion = makePromotion({
        groups: [
          {
            name: "Extra",
            type: "ELEGIBLE",
            requiredQuantity: 1,
            options: [
              { productId: "juice", quantity: 1 },
              { productId: "toast", quantity: 1 },
            ],
          },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {
        "promo-1-0": ["juice"],
      })

      expect(result.error).toBeUndefined()
      expect(result.items).toHaveLength(1)
      expect(result.items[0].productId).toBe("juice")
    })

    test("returns error when eligible selection is incomplete", () => {
      const promotion = makePromotion({
        groups: [
          {
            name: "Extra",
            type: "ELEGIBLE",
            requiredQuantity: 2,
            options: [
              { productId: "juice", quantity: 1 },
              { productId: "toast", quantity: 1 },
            ],
          },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {
        "promo-1-0": ["juice"], // only 1 of 2 required
      })

      expect(result.error).toBe("Completá Extra antes de confirmar.")
      expect(result.items).toHaveLength(0)
    })
  })

  describe("mixed groups (mandatory + eligible)", () => {
    test("builds items with mandatory options + selected eligible options", () => {
      const promotion = makePromotion({
        groups: [
          {
            name: "Base",
            type: "OBLIGATORIO",
            requiredQuantity: 2,
            options: [
              { productId: "coffee", quantity: 1 },
              { productId: "toast", quantity: 1 },
            ],
          },
          {
            name: "Extra",
            type: "ELEGIBLE",
            requiredQuantity: 1,
            options: [
              { productId: "juice", quantity: 1 },
              { productId: "fruit", quantity: 1 },
            ],
          },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {
        "promo-1-1": ["juice"],
      })

      expect(result.error).toBeUndefined()
      expect(result.items).toHaveLength(3)
      expect(result.items.map((i) => i.productId)).toEqual(["coffee", "toast", "juice"])
    })
  })

  describe("legacy comboItems fallback", () => {
    test("builds items from legacy comboItems when no groups defined", () => {
      const promotion = makePromotion({
        groups: [],
        comboItems: [
          { productId: "coffee", quantity: 1 },
          { productId: "toast", quantity: 1 },
        ],
      })

      const result = buildPromotionCartItems(promotion, productLookup, {})

      expect(result.error).toBeUndefined()
      expect(result.items).toHaveLength(2)
      expect(result.items[0].productId).toBe("coffee")
    })
  })
})
