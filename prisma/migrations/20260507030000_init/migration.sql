CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN', 'STAFF');
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MERCADO_PAGO', 'CASH', 'TRANSFER');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'IN_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE "MedicalMedal" AS ENUM ('oro', 'diamante', 'amatista');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'PATIENT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Patient" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Doctor" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "subSpecialty" TEXT NOT NULL,
  "bio" TEXT NOT NULL,
  "yearsExperience" INTEGER NOT NULL,
  "consultationPriceCents" INTEGER NOT NULL,
  "consultationDurationMinutes" INTEGER NOT NULL DEFAULT 45,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.9,
  "imageUrl" TEXT,
  "practicePhotoUrl" TEXT,
  "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "medal" "MedicalMedal" NOT NULL DEFAULT 'oro',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "professionalLicense" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Specialty" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Hospital" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilitySlot" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "availabilitySlotId" TEXT NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerPaymentIntentId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'mxn',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalVerification" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "professionalLicense" TEXT NOT NULL,
  "specialtyBoard" TEXT,
  "documentUrls" TEXT[],
  "status" "VerificationStatus" NOT NULL DEFAULT 'IN_REVIEW',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicalVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "ipAddress" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");
CREATE UNIQUE INDEX "Doctor_slug_key" ON "Doctor"("slug");
CREATE INDEX "Doctor_specialtyId_hospitalId_verificationStatus_idx" ON "Doctor"("specialtyId", "hospitalId", "verificationStatus");
CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");
CREATE UNIQUE INDEX "Hospital_name_key" ON "Hospital"("name");
CREATE UNIQUE INDEX "AvailabilitySlot_doctorId_startsAt_key" ON "AvailabilitySlot"("doctorId", "startsAt");
CREATE INDEX "AvailabilitySlot_doctorId_startsAt_isActive_idx" ON "AvailabilitySlot"("doctorId", "startsAt", "isActive");
CREATE UNIQUE INDEX "Appointment_availabilitySlotId_key" ON "Appointment"("availabilitySlotId");
CREATE INDEX "Appointment_patientId_status_idx" ON "Appointment"("patientId", "status");
CREATE INDEX "Appointment_doctorId_status_idx" ON "Appointment"("doctorId", "status");
CREATE INDEX "Payment_appointmentId_status_idx" ON "Payment"("appointmentId", "status");
CREATE UNIQUE INDEX "MedicalVerification_doctorId_key" ON "MedicalVerification"("doctorId");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_availabilitySlotId_fkey" FOREIGN KEY ("availabilitySlotId") REFERENCES "AvailabilitySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalVerification" ADD CONSTRAINT "MedicalVerification_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
