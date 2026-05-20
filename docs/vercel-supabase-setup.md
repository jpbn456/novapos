# Vercel + Supabase setup

This app already uses Prisma and Auth.js credentials login.

## Required environment variables

Set these in Vercel for the production environment:

- `DATABASE_URL`: Supabase transaction pooler URL (`6543`) with `pgbouncer=true&connection_limit=1`
- `DIRECT_URL`: Supabase direct database URL (`5432`) for Prisma CLI migrations
- `AUTH_SECRET`: long random secret for Auth.js
- `AUTH_URL`: production Vercel URL for the app

Optional one-time bootstrap variables:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Use `.env.example` as the reference format.

## Migration flow

Run Prisma migrations against Supabase with the direct connection:

```bash
npm run db:deploy
```

`prisma.config.ts` prefers `DIRECT_URL` and falls back to `DATABASE_URL` if needed.

## Manual Supabase fallback

If you cannot run Prisma CLI from your machine, use:

```text
supabase/migrations/20260519170000_init_schema_and_admin.sql
```

Paste that file into Supabase SQL Editor and run it once on an empty database.
It creates the current schema and bootstraps the production admin user used by this app's credentials login.

If the schema already exists and you only need the login user, run:

```text
supabase/migrations/20260519171000_bootstrap_admin.sql
```

## Admin password bootstrap

Create or update the admin user for the deployed app:

```bash
npm run db:bootstrap-admin
```

This will upsert the admin user using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Why this setup

- Runtime traffic from Vercel should use the Supabase pooler.
- Prisma migrations should use the direct database connection.
- `src/lib/prisma.ts` now relies on the full connection string so Supabase query params are preserved.
