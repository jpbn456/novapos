import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  revalidatePath: vi.fn(),
  getActivePromotionsData: vi.fn(),
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promotion: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
    },
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/lib/promotion-data", () => ({
  getActivePromotionsData: mocks.getActivePromotionsData,
}))

import { createPromotion, updatePromotion } from "../promotions"

describe("promotion actions with grouped combos", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { role: "ADMIN" } })
    mocks.create.mockReset()
    mocks.create.mockResolvedValue({ id: "promo-1" })
    mocks.update.mockReset()
    mocks.update.mockResolvedValue({ id: "promo-1" })
    mocks.findUnique.mockReset()
    mocks.findUnique.mockResolvedValue({ id: "promo-1" })
    mocks.revalidatePath.mockReset()
    mocks.getActivePromotionsData.mockReset()
  })

  test("creates a COMBO promotion with groups", async () => {
    const result = await createPromotion({
      name: "Combo desayuno",
      type: "COMBO",
      comboPrice: 25,
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

    expect(result).toEqual({ success: true })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "COMBO",
        comboPrice: 25,
        discountPercent: null,
        discountAmount: null,
        products: {
          create: [
            { productId: "coffee" },
            { productId: "toast" },
            { productId: "juice" },
            { productId: "fruit" },
          ],
        },
        groups: {
          create: [
            {
              name: "Base",
              type: "OBLIGATORIO",
              requiredQuantity: 2,
              sortOrder: 0,
              options: {
                create: [
                  { productId: "coffee", quantity: 1, sortOrder: 0 },
                  { productId: "toast", quantity: 1, sortOrder: 1 },
                ],
              },
            },
            {
              name: "Extra",
              type: "ELEGIBLE",
              requiredQuantity: 1,
              sortOrder: 1,
              options: {
                create: [
                  { productId: "juice", quantity: 1, sortOrder: 0 },
                  { productId: "fruit", quantity: 1, sortOrder: 1 },
                ],
              },
            },
          ],
        },
      }),
    })
  })

  test("rejects eligible groups whose requiredQuantity exceeds available options", async () => {
    const result = await createPromotion({
      name: "Combo inválido",
      type: "COMBO",
      comboPrice: 10,
      groups: [
        {
          name: "Elegibles",
          type: "ELEGIBLE",
          requiredQuantity: 2,
          options: [{ productId: "juice", quantity: 1 }],
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("cantidad requerida")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  test("rejects groups without options", async () => {
    const result = await createPromotion({
      name: "Combo vacío",
      type: "COMBO",
      comboPrice: 10,
      groups: [
        {
          name: "Vacío",
          type: "OBLIGATORIO",
          requiredQuantity: 1,
          options: [],
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("Cada grupo necesita al menos una opción")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  test("rejects duplicate productIds within the same group", async () => {
    const result = await createPromotion({
      name: "Combo repetido",
      type: "COMBO",
      comboPrice: 10,
      groups: [
        {
          name: "Base",
          type: "OBLIGATORIO",
          requiredQuantity: 2,
          options: [
            { productId: "coffee", quantity: 1 },
            { productId: "coffee", quantity: 1 },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("No repitas productos dentro del mismo grupo")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  test("accepts legacy comboItems payloads by converting them into a mandatory group", async () => {
    const result = await createPromotion({
      name: "Combo legacy",
      type: "COMBO",
      comboPrice: 25,
      comboItems: [
        { productId: "coffee", quantity: 1 },
        { productId: "toast", quantity: 1 },
      ],
    })

    expect(result).toEqual({ success: true })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create.mock.calls[0][0]).toEqual({
      data: expect.objectContaining({
        groups: {
          create: [
            {
              name: "Grupo obligatorio",
              type: "OBLIGATORIO",
              requiredQuantity: 2,
              sortOrder: 0,
              options: {
                create: [
                  { productId: "coffee", quantity: 1, sortOrder: 0 },
                  { productId: "toast", quantity: 1, sortOrder: 1 },
                ],
              },
            },
          ],
        },
        products: {
          create: [{ productId: "coffee" }, { productId: "toast" }],
        },
      }),
    })
  })

  test("updates a promotion by deleting prior groups and recreating them", async () => {
    const result = await updatePromotion("promo-1", {
      name: "Combo editado",
      type: "COMBO",
      discountAmount: 5,
      groups: [
        {
          name: "Nuevo grupo",
          type: "OBLIGATORIO",
          requiredQuantity: 1,
          options: [{ productId: "coffee", quantity: 1 }],
        },
      ],
    })

    expect(result).toEqual({ success: true })
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      select: { id: true },
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: expect.objectContaining({
        name: "Combo editado",
        products: {
          deleteMany: {},
          create: [{ productId: "coffee" }],
        },
        groups: {
          deleteMany: {},
          create: [
            {
              name: "Nuevo grupo",
              type: "OBLIGATORIO",
              requiredQuantity: 1,
              sortOrder: 0,
              options: {
                create: [{ productId: "coffee", quantity: 1, sortOrder: 0 }],
              },
            },
          ],
        },
        comboItems: {
          deleteMany: {},
          create: [],
        },
      }),
    })
  })
})
