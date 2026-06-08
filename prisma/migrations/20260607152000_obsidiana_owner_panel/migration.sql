ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "priceRange" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceListing_userId_key" ON "MarketplaceListing"("userId");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_userId_idx" ON "MarketplaceListing"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'MarketplaceListing_userId_fkey'
      AND table_name = 'MarketplaceListing'
  ) THEN
    ALTER TABLE "MarketplaceListing"
      ADD CONSTRAINT "MarketplaceListing_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
