-- AddColumn: secretaryCreated, guestPatientName, guestPatientPhone on Appointment
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "secretaryCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestPatientName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestPatientPhone" TEXT;

-- CreateTable: DoctorSecretaryLink
CREATE TABLE IF NOT EXISTS "DoctorSecretaryLink" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorSecretaryLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorSecretaryLink_doctorId_key" ON "DoctorSecretaryLink"("doctorId");
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorSecretaryLink_token_key" ON "DoctorSecretaryLink"("token");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DoctorSecretaryLink_doctorId_fkey'
  ) THEN
    ALTER TABLE "DoctorSecretaryLink" ADD CONSTRAINT "DoctorSecretaryLink_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
