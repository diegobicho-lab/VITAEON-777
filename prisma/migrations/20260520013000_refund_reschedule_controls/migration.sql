-- Refund and reschedule controls for private beta appointment operations.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reschedulePreferred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "refundRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "doctorRefundDecision" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "previousStartTime" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "previousEndTime" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3);

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerChargeId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmountCents" INTEGER;
