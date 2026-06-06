import { describe, expect, test, vi } from "vitest"

// Mock all server-side dependencies that the page file imports transitively
vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/promotion-data", () => ({ getActivePromotionsData: vi.fn() }))

import { formatComboSummary, formatGroupTypeLabel, normalizeGroups, validateGroups, type GroupForm } from "../page"

describe("validateGroups", () => {
  function makeGroup(overrides: Partial<GroupForm> = {}): GroupForm {
    return {
      name: "Grupo 1",
      type: "MANDATORY",
      requiredQuantity: 2,
      sortOrder: 0,
      options: [
        { productId: "coffee", quantity: 1, sortOrder: 0 },
        { productId: "toast", quantity: 1, sortOrder: 1 },
      ],
      ...overrides,
    }
  }

  test("returns null for valid mandatory group", () => {
    expect(validateGroups([makeGroup()])).toBeNull()
  })

  test("returns null for valid eligible group", () => {
    expect(
      validateGroups([
        makeGroup({
          type: "ELIGIBLE",
          requiredQuantity: 1,
          options: [
            { productId: "coffee", quantity: 1, sortOrder: 0 },
            { productId: "juice", quantity: 1, sortOrder: 1 },
          ],
        }),
      ])
    ).toBeNull()
  })

  test("returns error when groups are empty", () => {
    expect(validateGroups([])).toBe("El combo necesita al menos un grupo.")
  })

  test("returns error when group has no name", () => {
    expect(validateGroups([makeGroup({ name: "  " })])).toBe("Cada grupo necesita un nombre.")
  })

  test("returns error when group has no options", () => {
    expect(validateGroups([makeGroup({ options: [] })])).toBe(
      'El grupo Grupo 1 necesita al menos una opción.'
    )
  })

  test("returns error when option has empty productId", () => {
    expect(
      validateGroups([
        makeGroup({
          options: [{ productId: "", quantity: 1, sortOrder: 0 }],
        }),
      ])
    ).toBe("Completá todos los productos del grupo Grupo 1.")
  })

  test("returns error when eligible requiredQuantity exceeds options count", () => {
    expect(
      validateGroups([
        makeGroup({
          type: "ELIGIBLE",
          requiredQuantity: 3,
          options: [
            { productId: "a", quantity: 1, sortOrder: 0 },
            { productId: "b", quantity: 1, sortOrder: 1 },
          ],
        }),
      ])
    ).toBe("En Grupo 1, la cantidad requerida no puede superar las opciones.")
  })
})

describe("normalizeGroups", () => {
  test("sets requiredQuantity to options.length for mandatory groups", () => {
    const result = normalizeGroups([
      {
        name: "Base",
        type: "MANDATORY",
        requiredQuantity: 999, // ignored for mandatory
        sortOrder: 0,
        options: [
          { productId: "a", quantity: 1, sortOrder: 0 },
          { productId: "b", quantity: 1, sortOrder: 1 },
        ],
      },
    ])

    expect(result[0].requiredQuantity).toBe(2)
  })

  test("respects requiredQuantity for eligible groups", () => {
    const result = normalizeGroups([
      {
        name: "Extra",
        type: "ELIGIBLE",
        requiredQuantity: 2,
        sortOrder: 0,
        options: [
          { productId: "a", quantity: 1, sortOrder: 0 },
          { productId: "b", quantity: 1, sortOrder: 1 },
          { productId: "c", quantity: 1, sortOrder: 2 },
        ],
      },
    ])

    expect(result[0].requiredQuantity).toBe(2)
  })

  test("clamps eligible requiredQuantity to options.length", () => {
    const result = normalizeGroups([
      {
        name: "Extra",
        type: "ELIGIBLE",
        requiredQuantity: 10, // more than options
        sortOrder: 0,
        options: [
          { productId: "a", quantity: 1, sortOrder: 0 },
          { productId: "b", quantity: 1, sortOrder: 1 },
        ],
      },
    ])

    expect(result[0].requiredQuantity).toBe(2)
  })

  test("normalizes each option with quantity >= 1 and sortOrder based on index", () => {
    const result = normalizeGroups([
      {
        name: "G1",
        type: "MANDATORY",
        requiredQuantity: 1,
        sortOrder: 5,
        options: [
          { productId: "a", quantity: 0, sortOrder: 99 }, // quantity 0 → 1
          { productId: "b", quantity: 3, sortOrder: 42 },
        ],
      },
    ])

    expect(result[0].options).toEqual([
      { productId: "a", quantity: 1, sortOrder: 0 },
      { productId: "b", quantity: 3, sortOrder: 1 },
    ])
  })
})

describe("formatGroupTypeLabel", () => {
  test('returns "Obligatorio" for MANDATORY', () => {
    expect(formatGroupTypeLabel("MANDATORY")).toBe("Obligatorio")
  })

  test('returns "Elegible" for ELIGIBLE', () => {
    expect(formatGroupTypeLabel("ELIGIBLE")).toBe("Elegible")
  })
})

describe("formatComboSummary", () => {
  const base = {
    id: "p1",
    name: "Promo",
    type: "COMBO" as const,
    isActive: true,
    products: [],
    groups: [],
    tiers: [],
  }

  test("shows combo price when comboPrice is set", () => {
    expect(formatComboSummary({ ...base, comboPrice: 2500 })).toBe("Precio combo: $2500")
  })

  test("shows percentage when discountPercent is set", () => {
    expect(formatComboSummary({ ...base, discountPercent: 15 })).toBe("Descuento: 15%")
  })

  test("shows fixed amount when discountAmount is set", () => {
    expect(formatComboSummary({ ...base, discountAmount: 500 })).toBe("Descuento fijo: $500")
  })

  test("shows $0 when nothing is set", () => {
    expect(formatComboSummary({ ...base })).toBe("Descuento fijo: $0")
  })
})
