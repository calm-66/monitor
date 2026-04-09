-- Add previewDomain and productionDomain columns to Project table
ALTER TABLE "Project" 
ADD COLUMN "previewDomain" TEXT,
ADD COLUMN "productionDomain" TEXT;

-- Example update for usonly project (update with actual domain values)
-- UPDATE "Project" 
-- SET "previewDomain" = 'usonly-preview.vercel.app',
--     "productionDomain" = 'usonly.com'
-- WHERE name = 'usonly';