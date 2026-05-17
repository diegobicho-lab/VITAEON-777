ALTER TABLE "Doctor"
ADD COLUMN "affiliateCodeLast4" TEXT,
ADD COLUMN "affiliateDiscountEnabled" BOOLEAN NOT NULL DEFAULT false;
