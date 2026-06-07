DO $$ BEGIN
  CREATE TYPE "MarketplaceListingType" AS ENUM ('MEDICAL_REPRESENTATIVE', 'CATERING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplaceListingStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplacePlan" AS ENUM ('obsidiana');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplaceSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
  "id" TEXT NOT NULL,
  "type" "MarketplaceListingType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "cityOrZone" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "imageUrl" TEXT,
  "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'PENDING',
  "plan" "MarketplacePlan" NOT NULL DEFAULT 'obsidiana',
  "subscriptionStatus" "MarketplaceSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "providerSessionId" TEXT,
  "activeUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketplaceSubscriptionPayment" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "plan" "MarketplacePlan" NOT NULL DEFAULT 'obsidiana',
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'mxn',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
  "providerSessionId" TEXT,
  "providerPaymentId" TEXT,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceSubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceListing_type_name_cityOrZone_key" ON "MarketplaceListing"("type", "name", "cityOrZone");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_type_status_subscriptionStatus_createdAt_idx" ON "MarketplaceListing"("type", "status", "subscriptionStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_providerSubscriptionId_idx" ON "MarketplaceListing"("providerSubscriptionId");
CREATE INDEX IF NOT EXISTS "MarketplaceSubscriptionPayment_listingId_status_createdAt_idx" ON "MarketplaceSubscriptionPayment"("listingId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketplaceSubscriptionPayment_providerSessionId_idx" ON "MarketplaceSubscriptionPayment"("providerSessionId");
CREATE INDEX IF NOT EXISTS "MarketplaceSubscriptionPayment_providerCustomerId_idx" ON "MarketplaceSubscriptionPayment"("providerCustomerId");
CREATE INDEX IF NOT EXISTS "MarketplaceSubscriptionPayment_providerSubscriptionId_idx" ON "MarketplaceSubscriptionPayment"("providerSubscriptionId");

DO $$ BEGIN
  ALTER TABLE "MarketplaceSubscriptionPayment"
    ADD CONSTRAINT "MarketplaceSubscriptionPayment_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
