-- 为 UsOnly 创建独立的 Preview 和 Production Project 记录
-- 执行前先备份现有数据

-- 1. 创建 Preview 项目
INSERT INTO "Project" (id, name, description, apiKey, previewDomain, productionDomain, isActive, "createdAt", "updatedAt")
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',  -- Preview Project ID (UUID)
  'usonly-preview',
  'UsOnly Preview Environment - 预览环境数据',
  'mk_preview_' || substr(md5(random()::text), 1, 24),  -- 生成随机 API Key
  'usonly-preview.vercel.app',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  previewDomain = EXCLUDED.previewDomain,
  productionDomain = EXCLUDED.productionDomain,
  "updatedAt" = NOW();

-- 2. 创建 Production 项目
INSERT INTO "Project" (id, name, description, apiKey, previewDomain, productionDomain, isActive, "createdAt", "updatedAt")
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',  -- Production Project ID (UUID)
  'usonly-production',
  'UsOnly Production Environment - 生产环境数据',
  'mk_production_' || substr(md5(random()::text), 1, 24),  -- 生成随机 API Key
  NULL,
  'usonly.com',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  previewDomain = EXCLUDED.previewDomain,
  productionDomain = EXCLUDED.productionDomain,
  "updatedAt" = NOW();

-- 3. 查询创建结果
SELECT id, name, description, apiKey, previewDomain, productionDomain, isActive 
FROM "Project" 
WHERE name IN ('usonly-preview', 'usonly-production')
ORDER BY name;