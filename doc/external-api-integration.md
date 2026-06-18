# Monitor Dashboard 外部 API 接入参考文档

## 概述

本文档详细说明了如何在 Monitor Dashboard 中接入外部 API 以显示额外统计数据。通过标准化 API 接口设计，实现 Monitor 与外部服务（如 UsOnly）的解耦，使其他项目也能通过相同规范接入。

**示例场景**：在 Monitor Dashboard 中显示 UsOnly 项目的注册用户数统计。

---

## 架构设计原则

### 1. 解耦设计 (Decoupling)
- **Monitor 不依赖外部服务的数据库结构**
- **外部服务只需遵循标准 API 响应格式**
- **通过配置 `statsApiUrl` 字段动态指定 API 地址**

### 2. 降级处理 (Graceful Degradation)
- **API 调用失败不影响 Dashboard 其他功能正常显示**
- **无外部 API 配置时显示 "-" 占位符**

### 3. 标准化格式 (Standardization)
- **统一的 JSON 响应格式**
- **可选的 API Key 认证机制**
- **CORS 跨域支持**

---

## 数据流图

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Monitor       │────>│  External API    │────>│  External DB    │
│   Dashboard     │<────│  (UsOnly 等)      │<────│  (User 数据)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │
       │ 1. GET /api/projects/:id
       │    返回 statsApiUrl
       │
       │ 2. GET statsApiUrl
       │    返回 externalUserStats
       │
       v
┌─────────────────┐
│  Display Card   │
│  Registered     │
│  Users: 25      │
└─────────────────┘
```

---

## Monitor 项目修改清单

### 1. 数据库 Schema 修改

**文件**: `prisma/schema.prisma`

```prisma
model Project {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  apiKey      String    @unique
  domain      String?
  statsApiUrl String?   // 新增：外部统计 API 地址
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  events      Event[]
  ipLimitTrackers IpLimitTracker[]
}
```

### 2. 数据库迁移脚本

**文件**: `scripts/migrate.sql`

```sql
-- 添加 statsApiUrl 字段到 Project 表
ALTER TABLE "Project" ADD COLUMN "statsApiUrl" TEXT;
```

**执行方式**: 在 Neon Console 的 SQL Editor 中执行上述命令。

### 3. 类型定义更新

**文件**: `src/types/monitor.ts`

```typescript
// 外部用户统计 API 响应
export interface ExternalUserStats {
  success: boolean;
  data: {
    totalUsers: number;        // 总注册用户数
    newUsersToday?: number;    // 今日新增用户（可选）
    newUsersThisWeek?: number; // 本周新增用户（可选）
    newUsersThisMonth?: number;// 本月新增用户（可选）
  };
}

// 项目配置接口
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  apiKey: string;
  domain?: string | null;
  statsApiUrl?: string | null; // 外部统计 API 地址
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 统计响应数据接口
export interface StatsResponse {
  totalViews: number;
  uniqueVisitors: number;
  viewsByCountry: Array<{ country: string | null; count: number }>;
  viewsByDay: Array<{ date: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  ipResolveStats: {
    totalRequests: number;
    successfulResolves: number;
    rateLimitedCount: number;
    failedCount: number;
    rateLimitedRatio: number;
  };
  // 外部用户统计（可选）
  externalUserStats?: {
    totalUsers: number;
    newUsersToday?: number;
    newUsersThisWeek?: number;
    newUsersThisMonth?: number;
  };
}
```

### 4. 项目 API 路由修改

**文件**: `src/app/api/projects/[projectId]/route.ts`

在 `select` 语句中添加 `statsApiUrl: true`：

```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: {
    id: true,
    name: true,
    description: true,
    apiKey: true,
    domain: true,
    statsApiUrl: true,  // 新增
    isActive: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: { events: true }
    }
  }
});
```

### 5. Dashboard 页面修改

**文件**: `src/app/dashboard/[projectId]/page.tsx`

#### 5.1 添加状态和函数

```typescript
// 新增状态
const [projectInfo, setProjectInfo] = useState<Project | null>(null);

// 加载项目信息（包含 statsApiUrl）
const loadProjectInfo = useCallback(async () => {
  try {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = await response.json();
    if (data.success && data.data.project) {
      const project = data.data.project;
      setProjectName(project.name);
      setApiKey(project.apiKey);
      setProjectInfo(project);  // 保存完整项目信息
    }
  } catch (err) {
    console.error('Failed to load project info:', err);
  }
}, [projectId]);

// 获取外部用户统计
const loadExternalUserStats = useCallback(async () => {
  if (!projectInfo?.statsApiUrl) return null;
  
  try {
    const response = await fetch(projectInfo.statsApiUrl, {
      headers: {
        'X-API-Key': apiKey // 可选的认证
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to load external user stats:', err);
    return null; // API 调用失败不影响其他功能
  }
}, [projectInfo, apiKey]);
```

#### 5.2 添加 useEffect 钩子

```typescript
// 加载外部用户统计
useEffect(() => {
  const fetchExternalStats = async () => {
    if (!projectInfo?.statsApiUrl || !apiKey) return;
    
    const externalStats = await loadExternalUserStats();
    if (externalStats) {
      setStats(prev => {
        if (!prev) return null;
        return { ...prev, externalUserStats: externalStats };
      });
    }
  };
  
  fetchExternalStats();
}, [projectInfo, apiKey, loadExternalUserStats]);
```

#### 5.3 添加 UI 卡片

```tsx
{/* 注册用户数（外部 API） */}
<div className="bg-white rounded-lg shadow-md p-6">
  <h3 className="text-sm font-medium text-gray-500">Registered Users</h3>
  <p className="text-3xl font-bold text-gray-900 mt-2">
    {stats.externalUserStats?.totalUsers ?? '-'}
  </p>
  {stats.externalUserStats && (
    <div className="mt-2 text-xs text-gray-500 space-y-1">
      {stats.externalUserStats.newUsersToday !== undefined && (
        <p>Today: +{stats.externalUserStats.newUsersToday}</p>
      )}
      {stats.externalUserStats.newUsersThisWeek !== undefined && (
        <p>This Week: +{stats.externalUserStats.newUsersThisWeek}</p>
      )}
      {stats.externalUserStats.newUsersThisMonth !== undefined && (
        <p>This Month: +{stats.externalUserStats.newUsersThisMonth}</p>
      )}
    </div>
  )}
</div>
```

---

## 外部服务 API 规范

### 标准响应格式

```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "newUsersToday": 10,
    "newUsersThisWeek": 10,
    "newUsersThisMonth": 20
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Error message"
}
```

### CORS 配置

必须添加 CORS 响应头以允许跨域访问：

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

// OPTIONS 预检请求
export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

// GET 请求添加响应头
export async function GET(request: NextRequest) {
  // ... 业务逻辑
  return NextResponse.json(data, { headers: CORS_HEADERS });
}
```

### 可选的 API Key 认证

```typescript
const apiKey = request.headers.get('X-API-Key');
const expectedKey = process.env.MONITOR_API_KEY;

if (expectedKey && apiKey !== expectedKey) {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## 完整实施步骤

### 阶段 1: Monitor 项目修改

1. **修改数据库 Schema**
   - 编辑 `prisma/schema.prisma`，添加 `statsApiUrl` 字段

2. **执行数据库迁移**
   - 运行 SQL: `ALTER TABLE "Project" ADD COLUMN "statsApiUrl" TEXT;`

3. **更新类型定义**
   - 编辑 `src/types/monitor.ts`，添加 `ExternalUserStats` 接口
   - 更新 `Project` 和 `StatsResponse` 接口

4. **更新项目 API**
   - 编辑 `src/app/api/projects/[projectId]/route.ts`
   - 在 `select` 中添加 `statsApiUrl: true`

5. **更新 Dashboard**
   - 编辑 `src/app/dashboard/[projectId]/page.tsx`
   - 添加获取外部数据的逻辑和 UI 卡片

6. **提交并部署**
   ```bash
   git add -A
   git commit -m "feat: add external API integration for user stats"
   git push origin dev
   ```

### 阶段 2: 外部服务 API 创建

1. **创建 API 端点**
   - 创建 `src/app/api/monitor/stats/route.ts`

2. **实现标准响应格式**
   - 返回 `{ success: true, data: { ... } }`

3. **添加 CORS 支持**
   - 实现 `OPTIONS` 处理器
   - 在所有响应中添加 CORS 头

4. **配置环境变量（可选）**
   - 设置 `MONITOR_API_KEY` 进行认证

5. **提交并部署**
   ```bash
   git add -A
   git commit -m "feat: add /api/monitor/stats endpoint"
   git push origin preview
   ```

### 阶段 3: 配置与验证

1. **配置 statsApiUrl**
   - 在 Neon Console 中编辑 `Project` 表
   - 设置 `statsApiUrl` 为外部 API 地址
   - 示例：`https://usonly-preview.vercel.app/api/monitor/stats`

2. **验证功能**
   - 访问 Monitor Dashboard
   - 检查 "Registered Users" 卡片是否显示数据
   - 检查浏览器控制台是否有错误

---

## 常见问题排查

### 1. 显示 "-" 不显示数据

**可能原因**:
- `statsApiUrl` 字段为 NULL
- API 地址配置错误
- API 调用失败（静默）

**排查步骤**:
1. 检查数据库中 `statsApiUrl` 是否有值
2. 在浏览器 Network 标签查看 API 请求状态
3. 直接访问 API 地址验证返回数据

### 2. CORS 错误

**错误信息**:
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**解决方案**:
- 在外部 API 中添加 CORS 响应头
- 实现 `OPTIONS` 预检请求处理器

### 3. API 返回数据格式错误

**检查点**:
- 确保响应包含 `success` 和 `data` 字段
- 确保 `data.totalUsers` 是数字类型

---

## 接入其他 API 的示例

### 示例：接入订单统计 API

#### 1. 扩展类型定义

```typescript
// src/types/monitor.ts
export interface ExternalOrderStats {
  totalOrders: number;
  newOrdersToday?: number;
  newOrdersThisWeek?: number;
  newOrdersThisMonth?: number;
  totalRevenue?: number;
}

export interface StatsResponse {
  // ... 现有字段
  externalUserStats?: { ... };
  externalOrderStats?: ExternalOrderStats;  // 新增
}
```

#### 2. 创建订单 API（外部服务）

```typescript
// 外部服务：src/app/api/monitor/orders/route.ts
export async function GET(request: NextRequest) {
  // ... 订单统计逻辑
  return NextResponse.json({
    success: true,
    data: {
      totalOrders: 100,
      newOrdersToday: 5,
      totalRevenue: 9999.99
    }
  }, { headers: CORS_HEADERS });
}
```

#### 3. Dashboard 获取订单数据

```typescript
const loadExternalOrderStats = useCallback(async () => {
  if (!projectInfo?.ordersApiUrl) return null;
  // ... 类似 loadExternalUserStats
}, [projectInfo, apiKey]);
```

---

## 安全考虑


1. **API Key 认证**
   - 使用环境变量配置密钥
   - 通过 `X-API-Key` 请求头传递

2. **速率限制**
   - 在外部 API 中实现请求频率限制
   - 返回 `429 Too Many Requests` 状态码

3. **数据验证**
   - 验证输入参数
   -  sanitization 输出数据

---

## 总结

本文档描述了在 Monitor Dashboard 中接入外部统计数据的完整流程。核心设计原则：

1. **解耦**: Monitor 不依赖外部服务内部实现
2. **标准化**: 统一 JSON 响应格式
3. **降级**: API 失败不影响主功能
4. **可扩展**: 易于接入新的数据源

通过遵循此规范，可以快速将任何外部服务的数据集成到 Monitor Dashboard 中。