import type pg from "pg";

function getEnvDatabaseUrl(preferDirectUrl = false) {
  const dbUrl = preferDirectUrl
    ? process.env.DIRECT_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!dbUrl) {
    throw new Error("Set DATABASE_URL or DIRECT_URL before creating Prisma client")
  }

  return dbUrl
}

export function getPgPoolConfig(preferDirectUrl = false): pg.PoolConfig {
  const connectionString = getEnvDatabaseUrl(preferDirectUrl)
  const hostname = new URL(connectionString).hostname
  const useSsl = hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com")

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  }
}
