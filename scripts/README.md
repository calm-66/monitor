# 数据库迁移脚本说明

## migrate-to-domain-field.sql

将 `previewDomain`/`productionDomain` 字段替换为单个 `domain` 字段。

### 执行步骤

1. **连接到 Neon 数据库**
   ```bash
   psql "postgresql://user:password@host:port/database?sslmode=require"
   ```

2. **执行迁移脚本**
   ```bash
   psql -f scripts/migrate-to-domain-field.sql
   ```

3. **验证迁移结果**
   脚本会自动显示迁移后的项目列表。

