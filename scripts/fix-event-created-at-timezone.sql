-- 修复 Event 表 createdAt 字段时区问题
-- 执行此脚本后，新创建的事件将使用浏览器当地时间（由前端提供）
-- 
-- 说明：
-- 1. 此迁移移除 createdAt 字段的 DEFAULT now() 约束
-- 2. 应用代码已更新，前端会发送包含时区信息的 ISO 日期字符串
-- 3. 后端会解析该日期并存储到数据库
--
-- 执行方式：在 Neon 控制台或 psql 中运行此脚本

-- 移除 createdAt 字段的默认值
ALTER TABLE "Event" ALTER COLUMN "createdAt" DROP DEFAULT;

-- 验证修改
-- \d "Event"  -- 在 psql 中查看表结构