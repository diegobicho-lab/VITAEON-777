ALTER TABLE "Appointment"
ADD COLUMN "acceptedByDoctor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "acceptedAutomatically" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "acceptedReason" TEXT;
