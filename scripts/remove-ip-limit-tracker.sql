-- 迁移脚本：删除 IpLimitTracker 表
-- 创建日期：2026-04-16
-- 说明：此脚本用于删除不再使用的 IpLimitTracker 表及其相关索引

-- 开始事务
BEGIN;

-- 删除 IpLimitTracker 表
-- 注意：Prisma 的 Cascade 关系会自动处理外键约束
DROP TABLE IF EXISTS "IpLimitTracker" CASCADE;

-- 提交事务
COMMIT;

-- 验证：检查表是否已删除
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;