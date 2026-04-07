# Implementation Plan

## Overview

构建一个通用的 Serverless 监控平台（Monitor Platform），用于监控多个项目的用户行为，首期实现用户访问统计和 IP 地理来源分析功能。

## Scope

本项目将创建一个独立的 Next.js 应用，部署在 Vercel 上，使用 Neon PostgreSQL 作为数据库。平台支持多项目管理，每个项目有独立的数据空间和 API Key。

**首期功能范围：**
- 项目管理：创建、查看监控项目
- 数据采集：接收前端上报的页面访问事件
- IP 解析：使用 ip-api.com 解析用户 IP 到地理位置（免费 45 次/分钟），超出限制时在 Dashboard 上显示警告
- 基础 Dashboard：展示 PV/UV 统计和地区分布（带 HTTP Basic Auth 保护）
- 健康检查：简化的服务状态监控

**不在首期范围内的功能：**
- 会话追踪（Session Tracking）
- 热图功能
- 会话录制
- 复杂事件分析

---

## Types

定义核心数据结构和 TypeScript 类型。

### Prisma Schema 类型定义

```prisma
// 项目表 - 用于多租户隔离
model Project {
  id String @id @default(uuid())
  name String @unique // 项目名称（如 'usonly'）
  description String? // 项目描述
  apiKey String @unique // API Key (用于 SDK 认证)
  domain String? // 项目域名 (可选)
  isActive Boolean @default(true) // 是否启用
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  events Event[]
}

// 事件表 - 记录所有访问事件
model Event {
  id String @id @default(cuid())
  projectId String // 所属项目 ID
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // 事件基础信息
  eventType String // 事件类型：pageview/click/custom
  eventName String? // 事件名称（可选）
  sessionId String? // 会话 ID（可选，用于后续扩展）

  // 页面信息
  pageUrl String? // 页面 URL
  pageTitle String? // 页面标题
  referrer String? // 来源页面

  // 用户信息（匿名）
  userId String? // 匿名用户 ID（客户端生成）
  ipAddress String? // IP 地址（用于地理位置解析）

  // 地理位置信息
  country String? // 国家
  region String? // 省份/州
  city String? // 城市
  latitude Float? // 纬度
  longitude Float? // 经度

  // 设备信息
  userAgent String? // User-Agent
  deviceType String? // 设备类型：desktop/mobile/tablet
  browser String? // 浏览器名称
  os String? // 操作系统

  // 屏幕信息
  screenWidth Int? // 屏幕宽度
  screenHeight Int? // 屏幕高度

  // 额外元数据
  metadata Json? // 额外数据（JSON 格式）

  createdAt DateTime @default(now())

  @@index([projectId, createdAt]) // 按项目和时间查询
  @@index([projectId, eventType]) // 按项目和类型查询
  @@index([country]) // 按地区统计
}

// IP 解析限制追踪表 - 用于统计超出限制的情况
model IpLimitTracker {
  id String @id @default(cuid())
  projectId String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  date String // 日期字符串 YYYY-MM-DD
  totalRequests Int @default(0) // 总请求数
  successfulResolves Int @default(0) // 成功解析数
  rateLimitedCount Int @default(0) // 被限流次数
  failedCount Int @default(0) // 失败次数

  @@unique([projectId, date]) // 每天一条记录
}
```

### TypeScript 类型定义

```typescript
// src/types/monitor.ts

// 项目配置
export interface Project {
  id: string;
  name: string;
  description?: string;
  apiKey: string;
  domain?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 事件上报请求体
export interface EventPayload {
  eventType: 'pageview' | 'click' | 'custom';
  eventName?: string;
  sessionId?: string;
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  userId?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  metadata?: Record<string, any>;
}

// 解析后的地理位置信息
export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  status?: 'success' | 'fail';
  message?: string; // 错误信息（如 rate limited）
}

// 设备信息
export interface DeviceInfo {
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
}

// 统计响应数据
export interface StatsResponse {
  totalViews: number;
  uniqueVisitors: number;
  viewsByCountry: Array<{ country: string; count: number }>;
  viewsByDay: Array<{ date: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  ipResolveStats: {
    totalRequests: number;
    successfulResolves: number;
    rateLimitedCount: number;
    failedCount: number;
    rateLimitedRatio: number; // 被限流比例
  };
}

// IP 解析限制追踪
export interface IpLimitStats {
  totalRequests: number;
  successfulResolves: number;
  rateLimitedCount: number;
  failedCount: number;
  rateLimitedRatio: number;
}
```

---

## Files

### 新创建的文件

```
monitor-platform/ # 新项目根目录
├── .env.example # 环境变量示例
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── prisma/
│ └── schema.prisma # 监控平台数据库模型
├── src/
│ ├── app/
│ │ ├── layout.tsx # 根布局
│ │ ├── page.tsx # 首页（项目列表）
│ │ ├── api/
│ │ │ ├── projects/
│ │ │ │ ├── route.ts # GET/POST 项目列表
│ │ │ │ └── [projectId]/
│ │ │ │ └── route.ts # GET/DELETE 单个项目
│ │ │ ├── events/
│ │ │ │ └── route.ts # POST 事件上报
│ │ │ ├── stats/
│ │ │ │ └── route.ts # GET 统计数据
│ │ │ └── health/
│ │ │ └── route.ts # GET 健康检查
│ │ └── dashboard/
│ │ └── [projectId]/
│ │ └── page.tsx # 项目详情 Dashboard（带 Basic Auth）
│ ├── types/
│ │ └── monitor.ts # TypeScript 类型定义
│ └── lib/
│ ├── prisma.ts # Prisma 客户端
│ ├── geoip.ts # IP 地理位置解析（ip-api.com）
│ ├── auth.ts # HTTP Basic Auth 验证
│ └── utils.ts # 工具函数
└── public/
  └── monitor.js # 前端采集脚本（批量上报）
```

### 文件详细说明

| 文件路径 | 目的 | 主要内容 |
|----------|------|----------|
| `prisma/schema.prisma` | 数据库模型 | Project、Event、IpLimitTracker 三个表 |
| `src/app/page.tsx` | 首页 | 项目列表展示和创建新项目表单 |
| `src/app/api/projects/route.ts` | 项目 API | 创建和获取项目列表 |
| `src/app/api/events/route.ts` | 事件 API | 接收事件上报、IP 解析、存储、限流追踪 |
| `src/app/api/stats/route.ts` | 统计 API | 聚合查询返回统计数据（含 IP 解析限制统计） |
| `src/app/api/health/route.ts` | 健康检查 | 返回服务状态（数据库连接、响应时间） |
| `src/app/dashboard/[projectId]/page.tsx` | Dashboard | 图表展示页面（带 HTTP Basic Auth） |
| `src/lib/geoip.ts` | IP 解析 | 调用 ip-api.com API 解析地理位置，处理限流 |
| `src/lib/auth.ts` | 认证 | HTTP Basic Auth 验证逻辑 |
| `public/monitor.js` | 前端脚本 | 批量采集并上报数据（1 分钟间隔） |

---

## Functions

### API 接口函数

#### POST /api/projects
- **目的**: 创建新的监控项目
- **输入**: `{ name: string, description?: string, domain?: string }`
- **输出**: `{ project: Project, apiKey: string }`
- **逻辑**:
  1. 验证项目名称唯一性
  2. 生成唯一 API Key (使用 crypto.randomUUID())
  3. 创建 Project 记录

#### GET /api/projects
- **目的**: 获取所有项目列表
- **输入**: 无
- **输出**: `{ projects: Project[] }`
- **逻辑**: 查询所有 isActive=true 的项目

#### GET /api/projects/[projectId]
- **目的**: 获取单个项目详情
- **输入**: projectId (URL 参数)
- **输出**: `{ project: Project }`
- **逻辑**: 根据 ID 查询项目

#### DELETE /api/projects/[projectId]
- **目的**: 删除项目
- **输入**: projectId (URL 参数)
- **输出**: `{ success: boolean }`
- **逻辑**: 级联删除项目和关联事件

#### POST /api/events
- **目的**: 接收事件上报
- **输入**: EventPayload[] (批量上报)
- **输出**: `{ success: boolean }`
- **逻辑**:
  1. 验证 API Key (从请求头 `X-API-Key`)
  2. 从请求头获取 IP 地址 (`x-forwarded-for`)
  3. 调用 ip-api.com 解析 IP 到地理位置（带限流检测）
  4. 更新 IpLimitTracker 记录
  5. 解析 User-Agent 获取设备信息
  6. 批量插入 Event 记录
- **CORS**: 添加跨域响应头

#### GET /api/stats
- **目的**: 获取统计数据
- **输入**: `projectId`, `startDate`, `endDate` (查询参数)
- **输出**: `StatsResponse`
- **逻辑**:
  1. 验证 API Key
  2. 聚合查询 PV/UV
  3. 按国家分组统计
  4. 按日期分组统计
  5. 热门页面排行
  6. 查询 IP 解析限制统计

#### GET /api/health
- **目的**: 健康检查
- **输入**: 无
- **输出**: `{ status: 'ok' | 'error', database: 'connected' | 'disconnected', responseTime: number, timestamp: string }`
- **逻辑**:
  1. 测试数据库连接
  2. 测量响应时间
  3. 返回服务状态

### 工具函数

#### `src/lib/geoip.ts`

```typescript
// 解析 IP 到地理位置（带限流处理）
export async function resolveGeoIP(ip: string): Promise<GeoLocation>

// 检查是否超过 ip-api.com 的限流（45 次/分钟）
export function checkRateLimit(): Promise<boolean>

// 从 User-Agent 解析设备信息
export function parseUserAgent(userAgent: string): DeviceInfo

// 判断设备类型
export function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet'
```

#### `src/lib/auth.ts`

```typescript
// 验证 HTTP Basic Auth
export function verifyBasicAuth(authHeader: string, correctPassword: string): boolean

// 生成 401 响应（带 WWW-Authenticate 头）
export function getAuthChallengeResponse(): Response
```

#### `src/lib/utils.ts`

```typescript
// 生成 API Key
export function generateApiKey(): string

// 格式化日期
export function formatDate(date: Date): string

// 验证项目 ID 格式
export function isValidProjectId(id: string): boolean

// 从请求头获取客户端 IP
export function getClientIP(headers: Headers): string | null
```

---

## Classes

首期实现以函数式为主，不使用复杂类结构。

### 前端采集脚本（无类设计）

`public/monitor.js` 使用简单的函数式设计，支持批量上报：

```javascript
// 初始化配置
const config = {
  projectId: null,
  apiKey: null,
  endpoint: '/api/events',
  batchSize: 10, // 批量大小
  flushInterval: 60000 // 1 分钟
};

// 事件队列
let eventQueue = [];
let flushTimer = null;

// 初始化函数
function init(options) {
  config.projectId = options.projectId;
  config.apiKey = options.apiKey;
  config.endpoint = options.endpoint || '/api/events';
  config.batchSize = options.batchSize || 10;
  config.flushInterval = options.flushInterval || 60000;
  
  trackPageview();
  
  // 启动定时刷新
  flushTimer = setInterval(flushEvents, config.flushInterval);
  
  // 页面卸载时刷新
  window.addEventListener('beforeunload', flushEvents);
}

// 上报页面浏览
function trackPageview() {
  const payload = {
    eventType: 'pageview',
    pageUrl: window.location.href,
    pageTitle: document.title,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    userId: getOrCreateUserId()
  };
  queueEvent(payload);
}

// 队列事件
function queueEvent(payload) {
  eventQueue.push(payload);
  
  // 达到批量大小时立即刷新
  if (eventQueue.length >= config.batchSize) {
    flushEvents();
  }
}

// 刷新事件队列
function flushEvents() {
  if (eventQueue.length === 0) return;
  
  const eventsToSend = [...eventQueue];
  eventQueue = [];
  
  sendEvents(eventsToSend);
}

// 发送事件（带重试机制）
function sendEvents(events, retryCount = 0) {
  const maxRetries = 3;
  
  fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
      'X-Project-ID': config.projectId
    },
    body: JSON.stringify(events)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
  })
  .catch(error => {
    console.error('Monitor send error:', error);
    
    // 重试机制
    if (retryCount < maxRetries) {
      setTimeout(() => {
        sendEvents(events, retryCount + 1);
      }, 1000 * (retryCount + 1)); // 指数退避
    }
  });
}

// 获取或创建用户 ID
function getOrCreateUserId() {
  let userId = localStorage.getItem('monitor_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('monitor_user_id', userId);
  }
  return userId;
}

// 导出全局对象
window.Monitor = { init, trackPageview, flushEvents };
```

---

## Dependencies

### 新增 npm 依赖

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^5.22.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

### 外部服务依赖

| 服务 | 用途 | 成本 | 限制 |
|------|------|------|------|
| Vercel | 应用部署 | 免费 | - |
| Neon PostgreSQL | 数据库 | 免费 (0.5GB) | - |
| ip-api.com | IP 地理位置解析 | 免费 | 45 次/分钟 |

---

## Testing

### 测试策略

由于是个人使用的 MVP 项目，采用轻量级测试策略：

1. **手动测试**:
   - 创建项目后验证 API Key 生成
   - 在 UsOnly 中集成后验证数据上报
   - Dashboard 查看统计数据（含 IP 解析限制统计）
   - 验证 HTTP Basic Auth 保护

2. **API 验证**:
   - API Key 验证（无效 Key 应拒绝）
   - 项目不存在时应拒绝
   - CORS 跨域请求验证
   - IP 解析限流处理验证

3. **边界情况**:
   - IP 地址为空时的处理
   - IP 解析 API 超时/限流的降级处理
   - 批量上报的限制
   - 前端脚本重试机制验证

### 测试文件（可选）

如需自动化测试，可创建：
```
src/app/api/events/__tests__/route.test.ts
src/app/api/health/__tests__/route.test.ts
src/lib/__tests__/geoip.test.ts
src/lib/__tests__/auth.test.ts
```

---

## Implementation Order

按以下顺序实施，确保每步可独立验证：

### 阶段 1: 项目初始化 (Day 1)
1. 创建项目目录结构和基础配置文件
2. 创建 `package.json` 和 `.env.example`
3. 创建 `prisma/schema.prisma` 数据库模型（含 IpLimitTracker 表）
4. 运行 `prisma generate` 和数据库迁移

### 阶段 2: 核心 API 开发 (Day 2-3)
5. 实现 `POST /api/projects` - 创建项目
6. 实现 `GET /api/projects` - 获取项目列表
7. 实现 `DELETE /api/projects/[projectId]` - 删除项目
8. 实现 `src/lib/geoip.ts` - IP 地理位置解析（ip-api.com，带限流处理）
9. 实现 `POST /api/events` - 事件上报 API（含 CORS、IP 限流追踪）
10. 实现 `GET /api/stats` - 统计数据 API（含 IP 解析限制统计）
11. 实现 `GET /api/health` - 健康检查端点

### 阶段 3: 前端脚本开发 (Day 3)
12. 创建 `public/monitor.js` - 前端采集脚本（批量上报 + 重试机制）
13. 在 UsOnly 项目中集成测试

### 阶段 4: Dashboard 界面 (Day 4-5)
14. 实现 `src/lib/auth.ts` - HTTP Basic Auth 验证
15. 创建首页 `src/app/page.tsx` - 项目列表
16. 创建 Dashboard `src/app/dashboard/[projectId]/page.tsx`（带 Basic Auth 保护）
17. 集成 Recharts 图表库
18. 实现数据可视化（PV/UV 趋势、地区分布、IP 解析限制统计）

### 阶段 5: 集成测试与部署 (Day 6)
19. 在 UsOnly 项目中添加监控脚本
20. 本地测试数据上报和展示
21. 部署到 Vercel
22. 配置生产环境变量（含 DASHBOARD_PASSWORD）
23. 运行生产数据库迁移

---

## Notes

### 安全考虑
- API Key 应保密，仅在前端脚本中使用（不敏感）
- Dashboard 使用 HTTP Basic Auth 保护
- IP 地址存储需考虑隐私合规（可定期清理）

### 性能优化
- 事件上报支持批量处理（减少请求次数）
- 前端脚本 1 分钟定时刷新
- 前端脚本失败重试（指数退避）
- 统计数据使用缓存（避免频繁聚合查询）
- 数据库索引优化（projectId + createdAt 复合索引）

### IP 解析限流处理
- ip-api.com 免费额度：45 次/分钟
- 超出限制时：
  - 记录到 IpLimitTracker
  - 不阻止事件存储（地理位置字段留空）
  - Dashboard 显示限流统计和警告

### 扩展方向
- 后续可添加会话追踪（Session Tracking）
- 支持自定义事件（Custom Events）
- 添加漏斗分析、留存分析等高级功能