import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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