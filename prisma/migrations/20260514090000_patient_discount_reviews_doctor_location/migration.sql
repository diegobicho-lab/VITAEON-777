CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'PENDING_REVIEW', 'REJECTED');

ALTER TABLE "Patient"
ADD COLUMN "welcomeDiscountAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "welcomeDiscountUsedAt" TIMESTAMP(3);

ALTER TABLE "Doctor"
ADD COLUMN "officeAddress" TEXT,
ADD COLUMN "officeReference" TEXT,
ADD COLUMN "cityState" TEXT,
ADD COLUMN "mapsUrl" TEXT,
ADD COLUMN "professionalPhone" TEXT,
ADD COLUMN "instagramUrl" TEXT,
ADD COLUMN "facebookUrl" TEXT,
ADD COLUMN "linkedinUrl" TEXT,
ADD COLUMN "websiteUrl" TEXT,
ADD COLUMN "whatsappUrl" TEXT;

ALTER TABLE "Appointment"
ADD COLUMN "originalAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountLabel" TEXT;

CREATE TABLE "DoctorReview" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "doctorReply" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DoctorReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoctorReview_appointmentId_key" ON "DoctorReview"("appointmentId");
CREATE INDEX "DoctorReview_doctorId_status_createdAt_idx" ON "DoctorReview"("doctorId", "status", "createdAt");
CREATE INDEX "DoctorReview_patientId_createdAt_idx" ON "DoctorReview"("patientId", "createdAt");

ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
