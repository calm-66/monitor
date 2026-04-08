-- 更新已有项目的 statsApiUrl 字段
-- 根据 domain 自动填充 statsApiUrl = domain + '/api/monitor/stats'

-- 更新 UsOnly-Preview 项目
UPDATE "Project" 
SET "statsApiUrl" = 'https://usonly-preview-calm-66s-projects.vercel.app/api/monitor/stats'
WHERE "name" = 'UsOnly-Preview';

-- 通用更新语句：为所有有 domain 但没有 statsApiUrl 的项目自动填充
-- 注意：PostgreSQL 需要使用 CASE 语句处理字符串拼接
UPDATE "Project"
SET "statsApiUrl" = 
  CASE 
    WHEN "domain" IS NOT NULL AND "domain" != '' THEN
      CASE 
        WHEN "domain" LIKE '%/' THEN CONCAT(LEFT("domain", LENGTH("domain") - 1), '/api/monitor/stats')
        ELSE CONCAT("domain", '/api/monitor/stats')
      END
    ELSE NULL
  END
WHERE "statsApiUrl" IS NULL AND "domain" IS NOT NULL AND "domain" != '';