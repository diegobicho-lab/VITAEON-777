-- Stripe Connect for doctor appointment payouts and formal cancellation requests.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "stripeOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "chargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "bankAccountLast4" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_stripeAccountId_key" ON "Doctor"("stripeAccountId");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerCheckoutSessionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transferStatus" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_providerCheckoutSessionId_idx" ON "Payment"("providerCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "Payment_doctorId_status_idx" ON "Payment"("doctorId", "status");

ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SubscriptionPayment_providerCustomerId_idx" ON "SubscriptionPayment"("providerCustomerId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_providerSubscriptionId_idx" ON "SubscriptionPayment"("providerSubscriptionId");

CREATE TABLE IF NOT EXISTS "CancellationRequest" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendiente',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CancellationRequest_appointmentId_fkey'
  ) THEN
    ALTER TABLE "CancellationRequest"
      ADD CONSTRAINT "CancellationRequest_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CancellationRequest_doctorId_fkey'
  ) THEN
    ALTER TABLE "CancellationRequest"
      ADD CONSTRAINT "CancellationRequest_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CancellationRequest_patientId_fkey'
  ) THEN
    ALTER TABLE "CancellationRequest"
      ADD CONSTRAINT "CancellationRequest_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CancellationRequest_appointmentId_status_idx" ON "CancellationRequest"("appointmentId", "status");
CREATE INDEX IF NOT EXISTS "CancellationRequest_doctorId_status_createdAt_idx" ON "CancellationRequest"("doctorId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CancellationRequest_patientId_status_createdAt_idx" ON "CancellationRequest"("patientId", "status", "createdAt");
