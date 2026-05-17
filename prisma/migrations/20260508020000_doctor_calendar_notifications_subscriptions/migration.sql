CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'PENDING', 'ACTIVE', 'FAILED', 'CANCELLED');

ALTER TABLE "Doctor"
ADD COLUMN "professionalLicensePhotoUrl" TEXT,
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" "MedicalMedal" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'mxn',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
  "providerSessionId" TEXT,
  "providerPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicationSearchLog" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MedicationSearchLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE INDEX "SubscriptionPayment_userId_status_createdAt_idx" ON "SubscriptionPayment"("userId", "status", "createdAt");
CREATE INDEX "SubscriptionPayment_providerSessionId_idx" ON "SubscriptionPayment"("providerSessionId");
CREATE INDEX "MedicationSearchLog_doctorId_createdAt_idx" ON "MedicationSearchLog"("doctorId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationSearchLog" ADD CONSTRAINT "MedicationSearchLog_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
