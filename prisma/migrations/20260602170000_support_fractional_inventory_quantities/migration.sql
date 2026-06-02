ALTER TABLE "Product"
  ALTER COLUMN "lowStockThreshold" TYPE DECIMAL(12,3) USING "lowStockThreshold"::DECIMAL(12,3),
  ALTER COLUMN "lowStockThreshold" SET DEFAULT 10;

ALTER TABLE "Inventory"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3),
  ALTER COLUMN "quantity" SET DEFAULT 0;

ALTER TABLE "SaleItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3);

ALTER TABLE "TransferItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3);

ALTER TABLE "PurchaseOrderItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3),
  ALTER COLUMN "receivedQty" TYPE DECIMAL(12,3) USING "receivedQty"::DECIMAL(12,3),
  ALTER COLUMN "receivedQty" SET DEFAULT 0;

ALTER TABLE "InventoryMovement"
  ALTER COLUMN "quantityDelta" TYPE DECIMAL(12,3) USING "quantityDelta"::DECIMAL(12,3),
  ALTER COLUMN "quantityBefore" TYPE DECIMAL(12,3) USING "quantityBefore"::DECIMAL(12,3),
  ALTER COLUMN "quantityAfter" TYPE DECIMAL(12,3) USING "quantityAfter"::DECIMAL(12,3);
