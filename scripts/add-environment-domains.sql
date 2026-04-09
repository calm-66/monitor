-- Step 1: Add previewDomain and productionDomain columns to Project table
ALTER TABLE "Project" 
ADD COLUMN "previewDomain" TEXT,
ADD COLUMN "productionDomain" TEXT;

-- Step 2: Copy existing domain data to productionDomain (if needed)
-- UPDATE "Project" 
-- SET "productionDomain" = "domain"
-- WHERE "domain" IS NOT NULL;

-- Step 3: Drop the old domain column
ALTER TABLE "Project" 
DROP COLUMN "domain";

-- Step 4: Drop the statsApiUrl column (no longer needed, will be generated dynamically)
ALTER TABLE "Project" 
DROP COLUMN "statsApiUrl";

-- Example update for usonly project (update with actual domain values)
UPDATE "Project" 
SET "previewDomain" = 'usonly-preview.vercel.app',
    "productionDomain" = 'usonly.com'
WHERE name = 'usonly';
