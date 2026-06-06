-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('MANDATORY', 'ELIGIBLE');

-- CreateTable
CREATE TABLE "PromotionGroup" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" "GroupType" NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromotionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionGroupOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromotionGroupOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionGroup_promotionId_idx" ON "PromotionGroup"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionGroupOption_groupId_productId_key" ON "PromotionGroupOption"("groupId", "productId");

-- AddForeignKey
ALTER TABLE "PromotionGroup" ADD CONSTRAINT "PromotionGroup_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionGroupOption" ADD CONSTRAINT "PromotionGroupOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PromotionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionGroupOption" ADD CONSTRAINT "PromotionGroupOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate legacy combo items into a single mandatory group per combo promotion
INSERT INTO "PromotionGroup" ("id", "promotionId", "name", "type", "requiredQuantity", "sortOrder")
SELECT
    CONCAT('legacy-group-', p."id") AS "id",
    p."id" AS "promotionId",
    '' AS "name",
    'MANDATORY'::"GroupType" AS "type",
    1 AS "requiredQuantity",
    0 AS "sortOrder"
FROM "Promotion" p
WHERE p."type" = 'COMBO'
  AND EXISTS (
    SELECT 1
    FROM "PromotionComboItem" pci
    WHERE pci."promotionId" = p."id"
  );

INSERT INTO "PromotionGroupOption" ("id", "groupId", "productId", "quantity", "sortOrder")
SELECT
    CONCAT('legacy-option-', pci."id") AS "id",
    CONCAT('legacy-group-', pci."promotionId") AS "groupId",
    pci."productId",
    pci."quantity",
    ROW_NUMBER() OVER (
        PARTITION BY pci."promotionId"
        ORDER BY pci."id"
    ) - 1 AS "sortOrder"
FROM "PromotionComboItem" pci
JOIN "Promotion" p ON p."id" = pci."promotionId"
WHERE p."type" = 'COMBO';

-- Rebuild promotion product index from group options and scale tiers
DELETE FROM "PromotionProduct";

INSERT INTO "PromotionProduct" ("id", "promotionId", "productId")
SELECT
    CONCAT('reindexed-product-', source."promotionId", '-', source."productId") AS "id",
    source."promotionId",
    source."productId"
FROM (
    SELECT pg."promotionId", pgo."productId"
    FROM "PromotionGroup" pg
    JOIN "PromotionGroupOption" pgo ON pgo."groupId" = pg."id"

    UNION

    SELECT pt."promotionId", pt."productId"
    FROM "PromotionTier" pt
    WHERE pt."productId" IS NOT NULL
) AS source
ON CONFLICT ("promotionId", "productId") DO NOTHING;
