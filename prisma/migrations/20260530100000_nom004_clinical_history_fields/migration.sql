ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "identificationCard" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "ethnicGroup" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "hereditaryFamilyHistory" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "systemsReview" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "diagnosesOrClinicalProblems" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN IF NOT EXISTS "therapeuticIndication" TEXT;
