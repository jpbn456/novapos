import { describe, expect, test } from "vitest"

import {
  calculatePurchaseOrderTotals,
  derivePurchaseOrderStatus,
  hasReceivedItems,
  serializePurchaseOrder,
} from "./purchase-orders"

describe("calculatePurchaseOrderTotals", () => {
  const sampleItems = [
    { quantity: 10, unitCost: 100 },
    { quantity: 5, unitCost: 50 },
  ]

  test("calculates totals with includeTax=true (default behavior)", () => {
    const result = calculatePurchaseOrderTotals(sampleItems)
    expect(result.subtotal).toBe(1250)
    expect(result.tax).toBe(262.5) // 1250 * 0.21
    expect(result.total).toBe(1512.5)
    expect(result.expensesTotal).toBe(0)
  })

  test("returns tax=0 when includeTax=false", () => {
    const result = calculatePurchaseOrderTotals(sampleItems, false)
    expect(result.subtotal).toBe(1250)
    expect(result.tax).toBe(0)
    expect(result.total).toBe(1250)
    expect(result.expensesTotal).toBe(0)
  })

  test("includes expenses in total when expenses array is provided", () => {
    const expenses = [
      { description: "Flete", amount: 200 },
      { description: "Seguro", amount: 150 },
    ]
    const result = calculatePurchaseOrderTotals(sampleItems, true, expenses)
    expect(result.subtotal).toBe(1250)
    expect(result.tax).toBe(262.5)
    expect(result.expensesTotal).toBe(350)
    expect(result.total).toBe(1862.5) // 1250 + 262.5 + 350
  })

  test("combines includeTax=false with expenses", () => {
    const expenses = [{ description: "Flete", amount: 200 }]
    const result = calculatePurchaseOrderTotals(sampleItems, false, expenses)
    expect(result.subtotal).toBe(1250)
    expect(result.tax).toBe(0)
    expect(result.expensesTotal).toBe(200)
    expect(result.total).toBe(1450) // 1250 + 0 + 200
  })

  test("handles empty items array", () => {
    const result = calculatePurchaseOrderTotals([], true)
    expect(result.subtotal).toBe(0)
    expect(result.tax).toBe(0)
    expect(result.total).toBe(0)
    expect(result.expensesTotal).toBe(0)
  })

  test("handles empty expenses array", () => {
    const result = calculatePurchaseOrderTotals(sampleItems, true, [])
    expect(result.subtotal).toBe(1250)
    expect(result.tax).toBe(262.5)
    expect(result.expensesTotal).toBe(0)
    expect(result.total).toBe(1512.5)
  })

  test("handles single item", () => {
    const result = calculatePurchaseOrderTotals([{ quantity: 3, unitCost: 200 }], false)
    expect(result.subtotal).toBe(600)
    expect(result.tax).toBe(0)
    expect(result.expensesTotal).toBe(0)
    expect(result.total).toBe(600)
  })

  test("includeTax defaults to true when not provided", () => {
    const result = calculatePurchaseOrderTotals([{ quantity: 1, unitCost: 100 }])
    expect(result.tax).toBe(21)
    expect(result.total).toBe(121)
  })

  test("expenses defaults to empty array when not provided", () => {
    const result = calculatePurchaseOrderTotals([{ quantity: 1, unitCost: 100 }], true)
    expect(result.expensesTotal).toBe(0)
    expect(result.total).toBe(121)
  })
})

describe("derivePurchaseOrderStatus", () => {
  test("returns RECEIVED when all items are fully received", () => {
    const result = derivePurchaseOrderStatus([
      { quantity: 10, receivedQty: 10 },
      { quantity: 5, receivedQty: 5 },
    ])
    expect(result).toBe("RECEIVED")
  })

  test("returns PARTIALLY_RECEIVED when some items are received", () => {
    const result = derivePurchaseOrderStatus([
      { quantity: 10, receivedQty: 5 },
      { quantity: 5, receivedQty: 0 },
    ])
    expect(result).toBe("PARTIALLY_RECEIVED")
  })

  test("returns fallback status when no items received", () => {
    const result = derivePurchaseOrderStatus([
      { quantity: 10, receivedQty: 0 },
      { quantity: 5, receivedQty: 0 },
    ], "CONFIRMED")
    expect(result).toBe("CONFIRMED")
  })

  test("returns fallback when items array is empty", () => {
    const result = derivePurchaseOrderStatus([], "PENDING")
    expect(result).toBe("PENDING")
  })
})

describe("hasReceivedItems", () => {
  test("returns true when any item has receivedQty > 0", () => {
    const result = hasReceivedItems([
      { receivedQty: 0 },
      { receivedQty: 3 },
    ])
    expect(result).toBe(true)
  })

  test("returns false when no items have receivedQty", () => {
    const result = hasReceivedItems([
      { receivedQty: 0 },
      { receivedQty: 0 },
    ])
    expect(result).toBe(false)
  })
})

describe("serializePurchaseOrder", () => {
  test("includes includeTax from the order object", () => {
    const order = {
      id: "test-1",
      includeTax: false,
      subtotal: 1000,
      tax: 0,
      total: 1000,
      items: [],
    }
    const result = serializePurchaseOrder(order)
    expect(result.includeTax).toBe(false)
  })

  test("defaults to true when includeTax is not present (backward compat)", () => {
    const order = {
      id: "test-2",
      subtotal: 1000,
      tax: 210,
      total: 1210,
      items: [],
    }
    const result = serializePurchaseOrder(order)
    expect(result.includeTax).toBe(true)
  })

  test("serializes items with rounded quantities", () => {
    const order = {
      id: "test-3",
      includeTax: true,
      subtotal: 500,
      tax: 105,
      total: 605,
      items: [
        {
          id: "item-1",
          productId: "p1",
          quantity: "10",
          receivedQty: "5",
          unitCost: "50",
          subtotal: "500",
          product: { id: "p1", name: "Test", price: "100", cost: "50" },
        },
      ],
    }
    const result = serializePurchaseOrder(order)
    expect(result.includeTax).toBe(true)
    expect(result.items[0].quantity).toBe(10)
    expect(result.items[0].unitCost).toBe(50)
  })

  test("serializes expenses when present", () => {
    const order = {
      id: "test-4",
      includeTax: true,
      subtotal: 1000,
      tax: 210,
      total: 1210,
      items: [],
      expenses: [
        { id: "exp-1", description: "Flete", amount: "200", createdAt: new Date().toISOString() },
      ],
    }
    const result = serializePurchaseOrder(order)
    expect(result.includeTax).toBe(true)
    expect(result.expenses).toHaveLength(1)
    expect(result.expenses[0].amount).toBe(200)
  })

  test("serializes attachments when present", () => {
    const order = {
      id: "test-5",
      includeTax: true,
      subtotal: 1000,
      tax: 210,
      total: 1210,
      items: [],
      attachments: [
        { id: "att-1", name: "factura.pdf", fileUrl: "/uploads/test.pdf", type: "RECEIPT", createdAt: new Date().toISOString() },
      ],
    }
    const result = serializePurchaseOrder(order)
    expect(result.includeTax).toBe(true)
    expect(result.attachments).toHaveLength(1)
    expect(result.attachments[0].name).toBe("factura.pdf")
  })
})
