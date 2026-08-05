-- Días completos marcados como no disponibles por el médico.
-- Migración puramente aditiva: crea una tabla nueva, no altera datos existentes.
CREATE TABLE "DoctorBlockedDate" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorBlockedDate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorBlockedDate_doctorId_date_idx" ON "DoctorBlockedDate"("doctorId", "date");

CREATE UNIQUE INDEX "DoctorBlockedDate_doctorId_date_key" ON "DoctorBlockedDate"("doctorId", "date");

ALTER TABLE "DoctorBlockedDate"
    ADD CONSTRAINT "DoctorBlockedDate_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
