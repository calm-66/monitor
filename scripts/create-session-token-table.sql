-- 创建 SessionToken 表用于 Dashboard 自动登录
-- 在 Neon Console 的 SQL Editor 中执行此脚本

-- 创建表
CREATE TABLE "SessionToken" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    expiresAt TIMESTAMPTZ NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX "SessionToken_token_idx" ON "SessionToken"(token);

-- 可选：创建定期清理过期 session 的函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM "SessionToken" WHERE expiresAt < NOW();
END;
$$ LANGUAGE plpgsql;