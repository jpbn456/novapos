-- CreateEnum
CREATE TYPE "PurchaseOrderAttachmentType" AS ENUM ('RECEIPT', 'BUDGET', 'OTHER');

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "includeTax" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PurchaseOrderExpense" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderAttachment" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "type" "PurchaseOrderAttachmentType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderExpense_purchaseOrderId_idx" ON "PurchaseOrderExpense"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderAttachment_purchaseOrderId_idx" ON "PurchaseOrderAttachment"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderExpense" ADD CONSTRAINT "PurchaseOrderExpense_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderAttachment" ADD CONSTRAINT "PurchaseOrderAttachment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
