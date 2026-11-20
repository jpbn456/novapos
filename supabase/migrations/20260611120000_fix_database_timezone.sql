-- Convert legacy timestamp columns to timestamptz and align the database default timezone.
-- Existing values are treated as UTC because Supabase was storing them in timestamp without time zone.

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET timezone TO %L',
    current_database(),
    'America/Argentina/Buenos_Aires'
  );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ALTER DATABASE timezone because current role lacks permission';
END $$;

SET TIME ZONE 'America/Argentina/Buenos_Aires';

ALTER TABLE IF EXISTS "Session"
  ALTER COLUMN "expires" TYPE TIMESTAMPTZ(3) USING "expires" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "VerificationToken"
  ALTER COLUMN "expires" TYPE TIMESTAMPTZ(3) USING "expires" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "User"
  ALTER COLUMN "emailVerified" TYPE TIMESTAMPTZ(3) USING "emailVerified" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Location"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Category"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Product"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Inventory"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Sale"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "CashSession"
  ALTER COLUMN "businessDate" TYPE TIMESTAMPTZ(3) USING "businessDate" AT TIME ZONE 'UTC',
  ALTER COLUMN "openedAt" TYPE TIMESTAMPTZ(3) USING "openedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "closedAt" TYPE TIMESTAMPTZ(3) USING "closedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "CashMovement"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Transfer"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Supplier"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "PurchaseOrder"
  ALTER COLUMN "expectedDate" TYPE TIMESTAMPTZ(3) USING "expectedDate" AT TIME ZONE 'UTC',
  ALTER COLUMN "receivedDate" TYPE TIMESTAMPTZ(3) USING "receivedDate" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "InventoryMovement"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE IF EXISTS "Promotion"
  ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "endsAt" TYPE TIMESTAMPTZ(3) USING "endsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
