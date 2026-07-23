-- AddColumn: reminderSentAt on Appointment (tracks when 24h reminder was dispatched)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
