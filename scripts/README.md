# 数据库迁移脚本说明

## create-separate-projects.sql

为 UsOnly 创建独立的 Preview 和 Production Project 记录，实现数据完全隔离。

### 执行步骤

1. **连接到 Neon 数据库**
   ```bash
   # 使用 psql 连接
   psql "postgresql://user:password@host:port/database?sslmode=require"
   ```

2. **执行 SQL 脚本**
   ```sql
   -- 在 psql 中执行
   \i scripts/create-separate-projects.sql
   ```

   或者在 Neon Console 中直接运行脚本内容。

3. **获取生成的 API Key**
   
   执行后查询结果会显示创建的两个项目：
   ```
   id | name | description | apiKey | previewDomain | productionDomain | isActive
   ```
   
   记录两个项目的 `id` 和 `apiKey` 字段。

4. **配置 Vercel 环境变量（UsOnly 项目）**

   在 Vercel Dashboard 中为 UsOnly 项目添加以下环境变量：

   **Preview 环境**：
   ```
   NEXT_PUBLIC_MONITOR_PREVIEW_PROJECT_ID=<从 SQL 结果获取的 preview project ID>
   NEXT_PUBLIC_MONITOR_PREVIEW_API_KEY=<从 SQL 结果获取的 preview API Key>
   ```

   **Production 环境**：
   ```
   NEXT_PUBLIC_MONITOR_PRODUCTION_PROJECT_ID=<从 SQL 结果获取的 production project ID>
   NEXT_PUBLIC_MONITOR_PRODUCTION_API_KEY=<从 SQL 结果获取的 production API Key>
   ```

   **注意**：在 Vercel 中设置环境变量时，需要分别为 Preview 和 Production 分支设置。

5. **验证配置**

   - 访问 UsOnly Preview 环境，检查 Monitor 脚本是否使用 Preview 配置
   - 访问 UsOnly Production 环境，检查 Monitor 脚本是否使用 Production 配置
   - 在 Monitor Dashboard 中查看两个独立的项目数据

### 回滚方案

如果需要恢复原来的单一 Project 配置：

```sql
-- 删除新建的两个项目（会级联删除对应的 Event 记录）
DELETE FROM "Project" WHERE name IN ('usonly-preview', 'usonly-production');
```

### 注意事项

1. 执行脚本前建议备份现有数据
2. 脚本使用 `ON CONFLICT (name) DO UPDATE`，重复执行会更新现有记录
3. API Key 使用随机生成，每次执行都会不同
4. 删除 Project 会级联删除所有关联的 Event 记录