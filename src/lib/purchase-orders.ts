import { roundQuantity } from "@/lib/quantity"

export type PurchaseOrderStatusValue =
  | "PENDING"
  | "CONFIRMED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"

type PurchaseOrderItemLike = {
  quantity: unknown
  receivedQty: unknown
  unitCost: unknown
}

export function calculatePurchaseOrderTotals(items: Array<Pick<PurchaseOrderItemLike, "quantity" | "unitCost">>) {
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0)
  const tax = subtotal * 0.21
  const total = subtotal + tax

  return { subtotal, tax, total }
}

export function derivePurchaseOrderStatus(
  items: Array<Pick<PurchaseOrderItemLike, "quantity" | "receivedQty">>,
  fallbackStatus: Extract<PurchaseOrderStatusValue, "PENDING" | "CONFIRMED"> = "CONFIRMED"
): Extract<PurchaseOrderStatusValue, "PENDING" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED"> {
  if (items.length === 0) {
    return fallbackStatus
  }

  const anyReceived = items.some((item) => toNumber(item.receivedQty) > 0)
  const allReceived = items.every((item) => toNumber(item.receivedQty) >= toNumber(item.quantity))

  if (allReceived) return "RECEIVED"
  if (anyReceived) return "PARTIALLY_RECEIVED"
  return fallbackStatus
}

export function hasReceivedItems(items: Array<Pick<PurchaseOrderItemLike, "receivedQty">>) {
  return items.some((item) => toNumber(item.receivedQty) > 0)
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0)
}

export function serializePurchaseOrder<T extends { subtotal: unknown; tax: unknown; total: unknown; items?: any[] }>(order: T) {
  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    tax: toNumber(order.tax),
    total: toNumber(order.total),
    items: order.items?.map((item: any) => ({
      ...item,
      quantity: roundQuantity(toNumber(item.quantity)),
      receivedQty: roundQuantity(toNumber(item.receivedQty)),
      unitCost: toNumber(item.unitCost),
      subtotal: toNumber(item.subtotal),
      product: item.product
        ? {
            ...item.product,
            price: item.product.price != null ? toNumber(item.product.price) : item.product.price,
            cost: item.product.cost != null ? toNumber(item.product.cost) : item.product.cost,
          }
        : item.product,
    })),
  }
}
