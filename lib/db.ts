import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

// In development, Next.js caches globalThis across module reloads.
// If the Prisma schema was updated and new models (vipSubscription, vipPackage) are missing,
// invalidate the cached client so a fresh instance is created with all models.
const existingClient = globalForPrisma.prisma;
const isStale =
  existingClient &&
  (!(existingClient as any).vipSubscription ||
    !(existingClient as any).vipPackage);

const prisma =
  existingClient && !isStale
    ? existingClient
    : new PrismaClient({
        adapter,
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;