// Prisma Client Singleton — Prisma 7 with pg adapter
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient() {
  if (!globalForPrisma.pool) {
    // Parse connection string to avoid @ password issues
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const match = dbUrl.match(/postgresql:\/\/([^:]+):(.+)@(.+):(\d+)\/(.+)/);
      if (match) {
        globalForPrisma.pool = new pg.Pool({
          user: match[1],
          password: match[2],
          host: match[3],
          port: parseInt(match[4]),
          database: match[5],
        });
      } else {
        globalForPrisma.pool = new pg.Pool({ connectionString: dbUrl });
      }
    } else {
      throw new Error("DATABASE_URL not defined");
    }
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
