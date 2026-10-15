import { Pool } from "pg";
import "dotenv/config";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log("Applying schema DDL changes...");

  // 1. Create VipPackage table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "VipPackage" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "durationDays" INTEGER NOT NULL,
      "pointsCost" INTEGER NOT NULL,
      "starsPrice" INTEGER NOT NULL DEFAULT 50,
      "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.99,
      "badge" TEXT,
      "features" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "VipPackage_pkey" PRIMARY KEY ("id")
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "VipPackage_key_key" ON "VipPackage"("key");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VipPackage_key_idx" ON "VipPackage"("key");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VipPackage_isActive_idx" ON "VipPackage"("isActive");`);

  // 2. Add columns to PaymentTransaction
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "vipPackageId" TEXT;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "orderType" TEXT NOT NULL DEFAULT 'POINTS_PACKAGE';`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "starsAmount" INTEGER;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "telegramPaymentChargeId" TEXT;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "providerChargeId" TEXT;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "orderPayload" TEXT;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "isRefunded" BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;`);
  await pool.query(`ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION;`);

  // Foreign key from PaymentTransaction to VipPackage
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentTransaction_vipPackageId_fkey'
      ) THEN
        ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_vipPackageId_fkey"
        FOREIGN KEY ("vipPackageId") REFERENCES "VipPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // Indexes and unique constraints on PaymentTransaction
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_telegramPaymentChargeId_key" ON "PaymentTransaction"("telegramPaymentChargeId");`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_orderPayload_key" ON "PaymentTransaction"("orderPayload");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderType_idx" ON "PaymentTransaction"("orderType");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderPayload_idx" ON "PaymentTransaction"("orderPayload");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "PaymentTransaction_telegramPaymentChargeId_idx" ON "PaymentTransaction"("telegramPaymentChargeId");`);

  // 3. Create VipSubscription table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "VipSubscription" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "packageId" TEXT,
      "planKey" TEXT NOT NULL,
      "planLabel" TEXT NOT NULL,
      "paymentTransactionId" TEXT,
      "paymentMethod" TEXT NOT NULL DEFAULT 'TELEGRAM_STARS',
      "costAmount" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'XTR',
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "VipSubscription_pkey" PRIMARY KEY ("id")
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "VipSubscription_paymentTransactionId_key" ON "VipSubscription"("paymentTransactionId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VipSubscription_userId_idx" ON "VipSubscription"("userId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VipSubscription_status_idx" ON "VipSubscription"("status");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VipSubscription_expiresAt_idx" ON "VipSubscription"("expiresAt");`);

  // Foreign keys for VipSubscription
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_userId_fkey'
      ) THEN
        ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_packageId_fkey'
      ) THEN
        ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "VipPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_paymentTransactionId_fkey'
      ) THEN
        ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_paymentTransactionId_fkey"
        FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log("Schema DDL successfully executed!");
  await pool.end();
}

main().catch((err) => {
  console.error("DDL failed:", err);
  process.exit(1);
});
