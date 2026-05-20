-- Run this if the schema already exists and you only need the admin user.
INSERT INTO "User" (
    "id",
    "name",
    "email",
    "password",
    "role",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    'admin-novapos',
    'novaadmin',
    'novalimpiezarc@gmail.com',
    '$2b$12$xaPwN1y1iI03HNo02Zrr7uV1okh0zhSzwPtqgquWdYQD.DYhpH3hq',
    'ADMIN',
    true,
    NOW(),
    NOW()
)
ON CONFLICT ("email") DO UPDATE SET
    "name" = EXCLUDED."name",
    "password" = EXCLUDED."password",
    "role" = EXCLUDED."role",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = NOW();
