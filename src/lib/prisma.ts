// Prisma Client Singleton — Prisma 7 with pg adapter
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getPgPoolConfig } from "@/lib/prisma-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient() {
  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new pg.Pool(getPgPoolConfig());
  }

  const adapter = new PrismaPg(globalForPrisma.pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
