# Monitor Dashboard 登录系统实施计划

## 概述

为 Monitor Dashboard 创建一个简化的 Session Token 认证系统，用于保护 Dashboard 访问，同时保持与 UsOnly 项目的数据交互不受影响。

## 范围

**包含**：
- Dashboard 登录页面（自定义 UI，替代 Basic Auth 弹窗）
- Session Token 机制（记住登录状态）
- 服务端认证中间件（保护 API routes）
- 登录/登出功能

**不包含**：
- 用户注册系统（仅单管理员用户）
- 用户管理界面
- 多用户支持

**与 UsOnly 的隔离**：
- UsOnly 继续使用 API Key 向 Monitor 上报数据
- Monitor 的登录系统独立于 UsOnly 的用户系统
- 两个数据库保持独立

## 类型定义

### Session Token 数据结构
```typescript
interface SessionToken {
  id: string;           // UUID
  token: string;        // 随机生成的 token
  expiresAt: Date;      // 过期时间
  createdAt: DateTime;  // 创建时间
  updatedAt: DateTime;  // 更新时间
}
```

### API 响应类型
```typescript
// 登录请求
interface LoginRequest {
  password: string;
}

// 登录响应
interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    expiresAt: string;  // ISO 8601 格式
  };
  error?: string;
}

// 验证 Session 响应
interface ValidateSessionResponse {
  valid: boolean;
}
```

## 文件修改清单

### 新建文件

1. **`src/app/api/auth/login/route.ts`** - 登录 API
   - 验证密码（与环境变量 DASHBOARD_PASSWORD 比较）
   - 创建 Session Token
   - 返回 token 和过期时间

2. **`src/app/api/auth/logout/route.ts`** - 登出 API
   - 删除 Session Token

3. **`src/app/api/auth/session/route.ts`** - 验证 Session API
   - 验证 token 是否有效
   - 支持滑动过期（延长 session 有效期）

4. **`src/app/login/page.tsx`** - 登录页面
   - 密码输入表单
   - 类似 UsOnly 的登录 UI

### 修改文件

1. **`prisma/schema.prisma`** - 添加 SessionToken 模型
   ```prisma
   // Session Token 表 - 用于 Dashboard 自动登录
   model SessionToken {
     id        String   @id @default(uuid())
     token     String   @unique
     expiresAt DateTime
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@index([token])
   }
   ```

2. **`src/app/dashboard/[projectId]/page.tsx`** - 修改认证逻辑
   - 移除客户端 Basic Auth 逻辑
   - 添加 Session Token 验证
   - 认证失败重定向到登录页

3. **`src/app/page.tsx`** - 首页添加认证检查
   - 检查 session 状态
   - 未登录时显示登录按钮或重定向

### 配置文件

1. **`.env.example`** - 添加环境变量示例
   ```
   DASHBOARD_PASSWORD=your_secure_password_here
   ```

## 函数实现

### 新建函数

1. **`createSessionToken()`** (src/app/api/auth/login/route.ts)
   - 生成随机 token
   - 设置 30 天过期时间
   - 保存到数据库

2. **`validateSessionToken(token: string)`** (src/app/api/auth/session/route.ts)
   - 查询数据库验证 token
   - 检查是否过期
   - 支持滑动过期

3. **`deleteSessionToken(token: string)`** (src/app/api/auth/logout/route.ts)
   - 删除指定 token

### 修改函数

1. **`handleLogin`** (src/app/dashboard/[projectId]/page.tsx)
   - 改为使用 /api/auth/login API
   - 保存 token 到 localStorage

## 依赖项

无需新增 npm 包，使用项目现有依赖：
- `crypto` (Node.js 内置) - 生成随机 token
- `prisma` - 数据库操作

## 数据库迁移

需要执行以下 SQL 迁移（在 Neon Console 中）：

```sql
-- 创建 SessionToken 表
CREATE TABLE "SessionToken" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    expiresAt TIMESTAMPTZ NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX "SessionToken_token_idx" ON "SessionToken"(token);
```

## 实施顺序

1. **数据库迁移** - 创建 SessionToken 表（需要在 Neon Console 中手动执行）
2. **更新 Prisma Schema** - 添加 SessionToken 模型 ✅ 已完成
3. **创建登录 API** - `/api/auth/login` ✅ 已完成
4. **创建登出 API** - `/api/auth/logout` ✅ 已完成
5. **创建 Session 验证 API** - `/api/auth/session` ✅ 已完成
6. **创建登录页面** - `/login` ✅ 已完成
7. **修改 Dashboard 页面** - 使用 Session Token 认证 ✅ 已完成
8. **修改首页** - 添加登录状态显示 ✅ 已完成
9. **清理旧代码** - 移除 Basic Auth 相关代码（可选）

## 安全考虑

1. **密码存储**：密码存储在环境变量 `DASHBOARD_PASSWORD` 中，不存储在数据库
2. **Token 生成**：使用 `crypto.randomBytes()` 生成安全的随机 token
3. **Token 过期**：Session Token 30 天后过期
4. **滑动过期**：每次验证时延长有效期，保持活跃用户登录状态
5. **HTTPS**：生产环境必须使用 HTTPS 传输

## 测试清单

- [ ] 登录功能（正确密码）
- [ ] 登录功能（错误密码）
- [ ] 自动登录（刷新页面）
- [ ] Session 过期处理
- [ ] 登出功能
- [ ] Dashboard 访问保护
- [ ] API 访问保护

## 已完成的工作

- ✅ 创建 `SessionToken` Prisma 模型
- ✅ 生成 SQL 迁移脚本 (`scripts/create-session-token-table.sql`)
- ✅ 创建 `/api/auth/login` API
- ✅ 创建 `/api/auth/logout` API
- ✅ 创建 `/api/auth/session` API
- ✅ 创建 `/login` 登录页面
- ✅ 修改 Dashboard 页面使用 Session Token 认证
- ✅ 修改首页添加登录状态显示
- ✅ 登录页面添加登出功能

## 后续步骤

1. **在 Neon Console 中执行数据库迁移**：
   - 打开 Neon Console
   - 运行 `scripts/create-session-token-table.sql` 中的 SQL 语句
   
2. **设置环境变量**：
   - 在 Vercel 中设置 `DASHBOARD_PASSWORD` 环境变量

3. **测试登录流程**：
   - 访问 `/login` 页面
   - 输入密码登录
   - 验证 Dashboard 访问
   - 测试登出功能
