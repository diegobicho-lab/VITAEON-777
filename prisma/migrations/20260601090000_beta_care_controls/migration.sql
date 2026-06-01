ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'AUTO_CANCELLED';

ALTER TABLE "AvailabilitySlot"
  ADD COLUMN IF NOT EXISTS "repeatBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedByMonthlyRepeat" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "repeatLabel" TEXT;

CREATE INDEX IF NOT EXISTS "AvailabilitySlot_doctorId_repeatBatchId_idx"
  ON "AvailabilitySlot"("doctorId", "repeatBatchId");

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "autoCancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoCancellationReason" TEXT;

ALTER TABLE "ClinicalHistory"
  ADD COLUMN IF NOT EXISTS "consultationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "diagnosis" TEXT,
  ADD COLUMN IF NOT EXISTS "treatment" TEXT,
  ADD COLUMN IF NOT EXISTS "additionalMedicalNotes" TEXT;
