-- 数据库迁移脚本：将 previewDomain/productionDomain 字段替换为 domain 字段
-- 执行日期：2026-04-10
-- 
-- 重要提示：执行前请备份数据库！

-- 步骤 1: 数据迁移
-- 将 previewDomain 的值复制到 domain（如果 previewDomain 有值）
-- 如果只有 productionDomain 有值，则使用 productionDomain
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "domain" TEXT;

UPDATE "Project" 
SET "domain" = COALESCE("previewDomain", "productionDomain")
WHERE "domain" IS NULL 
  AND ("previewDomain" IS NOT NULL OR "productionDomain" IS NOT NULL);

-- 步骤 2: 删除旧字段
ALTER TABLE "Project" DROP COLUMN IF EXISTS "previewDomain";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "productionDomain";

-- 步骤 3: 验证迁移结果
SELECT id, name, domain, "createdAt" 
FROM "Project" 
ORDER BY "createdAt" DESC;

-- 步骤 4: 如果验证通过，可以删除临时备份字段（如果有的话）
-- 注意：Prisma generate 会自动同步 schema 变更