-- Rename GroupType enum values from English to Spanish.
-- If the type doesn't exist yet (corrupted dev DB), create it fresh.
DO $$ BEGIN
  ALTER TYPE "GroupType" RENAME VALUE 'MANDATORY' TO 'OBLIGATORIO';
  ALTER TYPE "GroupType" RENAME VALUE 'ELIGIBLE' TO 'ELEGIBLE';
EXCEPTION
  WHEN undefined_object THEN
    CREATE TYPE "GroupType" AS ENUM ('OBLIGATORIO', 'ELEGIBLE');
END $$;
