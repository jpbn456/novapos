ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_cashSessionId_fkey";

ALTER TABLE "CashMovement"
ALTER COLUMN "cashSessionId" DROP NOT NULL;

ALTER TABLE "CashMovement"
ADD CONSTRAINT "CashMovement_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
