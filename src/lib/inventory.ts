import { roundQuantity } from "@/lib/quantity"

type InventoryMovementTypeValue =
  | "INITIAL"
  | "SALE"
  | "PURCHASE_RECEIPT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT"
  | "MANUAL_IN"
  | "MANUAL_OUT"

type InventoryMovementInput = {
  productId: string
  locationId: string
  quantityDelta: number
  type: InventoryMovementTypeValue
  notes?: string | null
  userId?: string | null
  saleId?: string | null
  purchaseOrderId?: string | null
  transferId?: string | null
}

export async function applyInventoryMovement(
  tx: any,
  input: InventoryMovementInput
) {
  const existingInventory = await tx.inventory.findUnique({
    where: {
      productId_locationId: {
        productId: input.productId,
        locationId: input.locationId,
      },
    },
  })

  const quantityBefore = existingInventory?.quantity ?? 0
  const normalizedQuantityBefore = roundQuantity(Number(quantityBefore))
  const normalizedQuantityDelta = roundQuantity(input.quantityDelta)
  const quantityAfter = roundQuantity(normalizedQuantityBefore + normalizedQuantityDelta)

  if (quantityAfter < 0) {
    throw new Error("Stock insuficiente para el producto")
  }

  if (existingInventory) {
    await tx.inventory.update({
      where: { id: existingInventory.id },
      data: { quantity: quantityAfter },
    })
  } else {
    await tx.inventory.create({
      data: {
        productId: input.productId,
        locationId: input.locationId,
        quantity: quantityAfter,
      },
    })
  }

  await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      locationId: input.locationId,
      userId: input.userId ?? null,
      saleId: input.saleId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      transferId: input.transferId ?? null,
      type: input.type,
      quantityDelta: normalizedQuantityDelta,
      quantityBefore: normalizedQuantityBefore,
      quantityAfter,
      notes: input.notes ?? null,
    },
  })

  return {
    quantityBefore: normalizedQuantityBefore,
    quantityAfter,
  }
}
