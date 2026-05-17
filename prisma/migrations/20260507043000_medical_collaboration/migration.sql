-- CreateEnum
CREATE TYPE "MedicalConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "MedicalConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MedicalConversationStatus" NOT NULL DEFAULT 'OPEN',
    "createdByDoctorId" TEXT NOT NULL,
    "recipientDoctorId" TEXT,
    "patientAlias" TEXT,
    "clinicalSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicalConversation_createdByDoctorId_createdAt_idx" ON "MedicalConversation"("createdByDoctorId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalConversation_recipientDoctorId_createdAt_idx" ON "MedicalConversation"("recipientDoctorId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalChatMessage_conversationId_createdAt_idx" ON "MedicalChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalChatMessage_senderUserId_createdAt_idx" ON "MedicalChatMessage"("senderUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "MedicalConversation" ADD CONSTRAINT "MedicalConversation_createdByDoctorId_fkey" FOREIGN KEY ("createdByDoctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalConversation" ADD CONSTRAINT "MedicalConversation_recipientDoctorId_fkey" FOREIGN KEY ("recipientDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalChatMessage" ADD CONSTRAINT "MedicalChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MedicalConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalChatMessage" ADD CONSTRAINT "MedicalChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
