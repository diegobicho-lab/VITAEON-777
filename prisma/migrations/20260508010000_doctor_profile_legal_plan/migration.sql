ALTER TABLE "Doctor" ADD COLUMN "legalDeclarationAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Doctor_medal_specialtyId_createdAt_idx" ON "Doctor"("medal", "specialtyId", "createdAt");
