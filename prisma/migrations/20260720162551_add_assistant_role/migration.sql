-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ASSISTANT';

-- CreateTable
CREATE TABLE "DoctorAssistant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAssistant_userId_key" ON "DoctorAssistant"("userId");

-- CreateIndex
CREATE INDEX "DoctorAssistant_doctorId_idx" ON "DoctorAssistant"("doctorId");

-- AddForeignKey
ALTER TABLE "DoctorAssistant" ADD CONSTRAINT "DoctorAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAssistant" ADD CONSTRAINT "DoctorAssistant_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
