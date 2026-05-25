-- Clinical histories and printable prescriptions for Amatista doctors.
CREATE TABLE "ClinicalHistory" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "nonPathologicalHistory" TEXT,
  "pathologicalHistory" TEXT,
  "surgicalHistory" TEXT,
  "fractureHistory" TEXT,
  "gynecoObstetricHistory" TEXT,
  "currentCondition" TEXT,
  "physicalExam" TEXT,
  "labsAndImaging" TEXT,
  "plan" TEXT,
  "prognosis" TEXT,
  "healthStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrescriptionTemplate" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "doctorName" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "professionalLicense" TEXT,
  "phone" TEXT,
  "officeAddress" TEXT,
  "headerImageUrl" TEXT,
  "signatureImageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Prescription" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "templateId" TEXT,
  "patientAge" TEXT,
  "diagnosis" TEXT,
  "medicationInstructions" TEXT,
  "dosage" TEXT,
  "frequency" TEXT,
  "duration" TEXT,
  "generalRecommendations" TEXT,
  "additionalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalHistory_doctorId_patientId_appointmentId_key" ON "ClinicalHistory"("doctorId", "patientId", "appointmentId");
CREATE UNIQUE INDEX "ClinicalHistory_appointmentId_key" ON "ClinicalHistory"("appointmentId");
CREATE INDEX "ClinicalHistory_doctorId_patientId_idx" ON "ClinicalHistory"("doctorId", "patientId");

CREATE UNIQUE INDEX "PrescriptionTemplate_doctorId_key" ON "PrescriptionTemplate"("doctorId");

CREATE INDEX "Prescription_doctorId_patientId_idx" ON "Prescription"("doctorId", "patientId");
CREATE INDEX "Prescription_appointmentId_idx" ON "Prescription"("appointmentId");

ALTER TABLE "ClinicalHistory" ADD CONSTRAINT "ClinicalHistory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalHistory" ADD CONSTRAINT "ClinicalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalHistory" ADD CONSTRAINT "ClinicalHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PrescriptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
