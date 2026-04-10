# Monitor Platform - 监控平台总结

## Overview

Monitor Platform 是一个全栈用户行为监控平台，用于监控 UsOnly 等项目的用户访问统计和地理来源分析。采用 Serverless 架构，部署在 Vercel 平台，使用 Neon PostgreSQL 数据库。

## 功能特性

### 1. 数据收集 (Client-side Tracking)
- **页面浏览追踪** (Pageview Tracking): 自动记录用户访问的页面 URL、标题、来源
- **自定义事件追踪** (Custom Event Tracking): 支持追踪任意自定义事件
- **点击事件追踪** (Click Tracking): 追踪特定元素的点击行为
- **批量上报** (Batch Reporting): 支持批量事件上报（默认 10 条或 60 秒）
- **重试机制** (Retry Mechanism): 指数退避重试（1s, 2s, 4s），最多 3 次

### 2. 数据处理
- **IP 地理位置解析**: 使用 ip-api.com 服务解析用户 IP 的地理位置（国家、省份、城市）
- **User-Agent 解析**: 解析设备类型（desktop/mobile/tablet）、浏览器、操作系统信息
- **限流处理**: 处理 ip-api.com 的 45 次/分钟限流，记录到 IpLimitTracker 表
- **多租户支持**: 通过 Project + API Key 实现多项目隔离

### 3. Server-side Integration（服务端集成）
- **外部 API 集成**: 从业务系统获取统计数据（注册用户数、每日登录用户数等）
- **CORS 解决方案**: 通过 `/api/external-stats` 代理 API 调用外部服务，避免浏览器 CORS 限制
- **自动刷新**: 每 5 分钟自动调用外部 API 刷新数据
- **手动刷新**: 支持 Refresh 按钮手动刷新
- **环境切换自动加载**: 切换 Preview/Production 环境时自动加载所有数据

### 4. Dashboard 展示
- **Registered Users**: 总注册用户数 + 今日/本周/本月新增（来自外部 API）
- **Daily Visitors (UV)**: 每日独立访客数（来自客户端追踪）
- **Daily Active Users**: 每日登录用户数（来自外部 API）
- **Daily Visitors (Last 30 Days)**: 30 天访问趋势柱状图
- **Daily Active Users (Last 30 Days)**: 30 天登录趋势柱状图
- **环境切换**: 支持 Preview/Production 环境切换，自动加载对应环境数据

## 技术架构

### 前端脚本 (monitor.js)
```
public/monitor.js
- 轻量级 vanilla JavaScript
- 自动初始化（通过 data 属性配置）
- 事件队列 + 批量上报
- localStorage 用户 ID 持久化
- 页面卸载时自动刷新队列
```

### Next.js API Routes
```
src/app/api/
├── events/route.ts       # 事件上报 API (POST, OPTIONS)
├── projects/route.ts     # 项目 CRUD API
├── stats/route.ts        # 统计数据 API
└── health/route.ts       # 健康检查 API
```

### 数据库 Schema (Prisma)
```prisma
model Project {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  apiKey      String   @unique
  domain      String?
  statsApiUrl String?   // 外部统计 API 地址
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  events      Event[]
  ipLimitTrackers IpLimitTracker[]
}

model Event {
  id          String   @id @default(cuid())
  projectId   String
  eventType   String   // pageview/click/custom
  eventName   String?
  sessionId   String?
  pageUrl     String?
  pageTitle   String?
  referrer    String?
  userId      String?
  ipAddress   String?
  country     String?
  region      String?
  city        String?
  latitude    Float?
  longitude   Float?
  userAgent   String?
  deviceType  String?
  browser     String?
  os          String?
  screenWidth Int?
  screenHeight Int?
  metadata    Json?
  createdAt   DateTime @default(now())
}

model IpLimitTracker {
  id                 String   @id @default(cuid())
  projectId          String
  date               String   // YYYY-MM-DD
  totalRequests      Int
  successfulResolves Int
  rateLimitedCount   Int
  failedCount        Int

  @@unique([projectId, date])
}
```

### 核心库函数
```
src/lib/
├── prisma.ts         # Prisma 客户端单例
├── geoip.ts          # IP 地理位置解析 + User-Agent 解析
└── utils.ts          # 工具函数（获取客户端 IP、日志等）

src/types/
└── monitor.ts        # TypeScript 类型定义
```

## 部署架构

```
┌─────────────────┐     ┌─────────────────┐
│   UsOnly 网站    │────▶│  monitor.js     │
│  (Vercel)       │     │  (Vercel)       │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  /api/events    │
                        │  (Vercel Func)  │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Neon PostgreSQL │
                        │   (Serverless)  │
                        └─────────────────┘
```

## 关键技术点

### 1. CORS 解决方案
**问题**：浏览器直接调用外部 API 时，Vercel Preview 环境的 HTTP→HTTPS 重定向导致 CORS 预检请求失败。

**方案**：服务器端代理
```
前端 → /api/external-stats (Monitor 服务器) → 外部 API
```

**原理**：
- CORS 是浏览器的安全机制，服务器对服务器请求没有 CORS 限制
- 前端调用同域的 `/api/external-stats` 代理 API
- 代理 API 用服务器身份请求外部 API，返回数据给前端

**关键代码**：
- `src/app/api/external-stats/route.ts` - 代理 API 端点
- Dashboard 中调用代理 API 而非直接调用外部 API

**辅助方案**：
- `vercel.json` 中配置 CORS headers（用于其他直接访问的场景）

### 2. 多环境支持
- **previewDomain + productionDomain**: 每个项目可配置两个环境的域名
- **动态 API 地址生成**: 根据当前选择的环境自动生成对应的 statsApiUrl
- **环境筛选器**: Dashboard 顶部支持切换 Preview/Production 环境

### 3. API 验证

- X-API-Key 和 X-Project-ID 请求头验证
- 项目状态检查（isActive）

### 4. IP 限流处理
- ip-api.com 限流时记录到 IpLimitTracker
- 按日期（YYYY-MM-DD）统计限流情况

### 5. 批量上报 + 重试
- 批量大小：10 条
- 刷新间隔：60 秒
- 指数退避重试：1s, 2s, 4s

## 环境变量

```bash
# 数据库
DATABASE_URL="postgresql://..."

# Dashboard 认证
DASHBOARD_PASSWORD="your_password"

# CORS 配置
ALLOWED_ORIGINS="https://usonly-*.vercel.app,https://example.com"
```

## 文件结构

```
Monitor/
├── public/
│   └── monitor.js          # 前端监控脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── events/
│   │   │   ├── projects/
│   │   │   ├── stats/
│   │   │   └── health/
│   │   ├── dashboard/
│   │   │   └── [projectId]/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── geoip.ts
│   │   └── utils.ts
│   └── types/
│       └── monitor.ts
├── prisma/
│   └── schema.prisma
├── doc/
│   └── summary.md
├── scripts/
│   └── migrate.sql
├── package.json
├── next.config.js
├── vercel.json
└── tsconfig.json
```

## 使用示例

### 1. 在项目中引入
```html
<script 
  src="https://monitor-git-dev-calm-66s-projects.vercel.app/monitor.js"
  data-project-id="your-project-id"
  data-api-key="your-api-key"
  data-endpoint="https://monitor-git-dev-calm-66s-projects.vercel.app/api/events"
  async
></script>
```

### 2. 手动初始化
```javascript
Monitor.init({
  projectId: 'your-project-id',
  apiKey: 'your-api-key',
  endpoint: 'https://your-domain.com/api/events'
});
```

### 3. 手动追踪事件
```javascript
Monitor.trackEvent('button_click', { button: 'signup' });
Monitor.trackPageview({ customData: 'value' });
Monitor.flush(); // 手动刷新
```

## 当前状态

✅ 功能正常
- 前端脚本加载正常
- 数据上报成功
- Dashboard 显示统计数据
- IP 地理位置解析正常
- Server-side Integration 正常

---

## 数据获取方式

Monitor 平台支持两种数据获取方式：

### 1. Client-side Tracking（客户端追踪）

**定义**：通过在用户浏览器中运行的 JavaScript 脚本（monitor.js）收集用户行为数据。

**数据流向**：
```
用户浏览器 → monitor.js → /api/events → Monitor Database
```

**收集的数据类型**：
- 页面浏览（Pageview）
- 点击事件（Click Event）
- 自定义事件（Custom Event）
- 设备信息（User-Agent、屏幕尺寸）
- 匿名用户 ID（localStorage 生成）

**适用场景**：
- 用户行为分析（浏览、点击）
- 流量统计（PV、UV）
- 来源分析（Referrer、地理位置）

### 2. Server-side Integration（服务端集成）

**定义**：Monitor 后端通过调用外部 API（statsApiUrl）从业务服务器获取业务数据。

**数据流向**：
```
Monitor Dashboard → statsApiUrl → 业务系统 API → 业务数据库
```

**收集的数据类型**：
- 注册用户数（Registered Users）
- 每日登录用户数（Daily Active Users）
- 其他业务指标

**适用场景**：
- 业务数据存储在服务端数据库中
- 需要聚合统计的业务指标

### 3. 对比总结

| 维度 | Client-side Tracking | Server-side Integration |
|------|---------------------|------------------------|
| **数据来源** | 浏览器/客户端 | 业务数据库 |
| **数据类型** | 行为数据 | 业务数据 |
| **数据流向** | Push（客户端推送） | Pull（Monitor 拉取） |
| **实时性** | 近实时 | 取决于调用频率（5 分钟） |
| **实现复杂度** | 低（嵌入脚本） | 中（API 开发） |