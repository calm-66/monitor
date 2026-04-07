# Monitor Platform - 监控平台总结

## Overview

Monitor Platform 是一个全栈用户行为监控平台，用于监控 UsOnly 等项目的用户访问统计和地理来源分析。采用 Serverless 架构，部署在 Vercel 平台，使用 Neon PostgreSQL 数据库。

## 功能特性

### 1. 数据收集
- **页面浏览追踪** (Pageview Tracking): 自动记录用户访问的页面 URL、标题、来源
- **自定义事件追踪** (Custom Event Tracking): 支持追踪任意自定义事件
- **点击事件追踪** (Click Tracking): 追踪特定元素的点击行为
- **批量上报** (Batch Reporting): 支持批量事件上报，减少网络请求
- **重试机制** (Retry Mechanism): 指数退避重试（1s, 2s, 4s），最多 3 次

### 2. 数据处理
- **IP 地理位置解析**: 使用 ip-api.com 服务解析用户 IP 的地理位置
- **User-Agent 解析**: 解析设备类型、浏览器、操作系统信息
- **限流处理**: 处理 ip-api.com 的 45 次/分钟限流，记录到 IpLimitTracker 表
- **多租户支持**: 通过 Project + API Key 实现多项目隔离

### 3. Dashboard 展示
- **总浏览量** (Total Views)
- **独立访客数** (Unique Visitors)
- **平均浏览/访客比** (Avg Views/Visitor)
- **IP 解析成功率** (IP Resolve Rate)
- **每日浏览趋势图** (Views by Day)
- **国家分布饼图** (Views by Country)
- **热门页面列表** (Top Pages)
- **IP 解析统计** (IP Resolution Stats)

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
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  events      Event[]
  ipTrackers  IpLimitTracker[]
}

model Event {
  id          String   @id @default(uuid())
  projectId   String
  eventType   String   @default("pageview")
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
  project     Project  @relation(fields: [projectId], references: [id])
}

model IpLimitTracker {
  id                 String   @id @default(uuid())
  projectId          String
  date               String
  totalRequests      Int      @default(0)
  successfulResolves Int      @default(0)
  rateLimitedCount   Int      @default(0)
  failedCount        Int      @default(0)
  project            Project  @relation(fields: [projectId], references: [id])
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

### 1. CORS 跨域配置
- API Routes 中添加跨域响应头
- 支持 OPTIONS 预检请求
- 允许自定义域名白名单

### 2. API 验证
- X-API-Key 和 X-Project-ID 请求头验证
- 项目状态检查（isActive）

### 3. IP 限流处理
- ip-api.com 限流时记录到 IpLimitTracker
- Dashboard 显示警告但不阻止事件存储

### 4. 批量上报 + 重试
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
│   │   │   └── projects/[id]/
│   │   └── layout.tsx
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
  data-project-id="28cc0e0a-aa4e-4421-b1d9-e311e34d2eed"
  data-api-key="mk_5Tms2UqLLBMDV24adDeCDRlpSK4CcHAO"
  data-endpoint="https://monitor-git-dev-calm-66s-projects.vercel.app/api/events"
  async
></script>
```

### 2. 手动追踪事件
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
- IP 地理位置解析正常（100% 解析率）

## 未来优化方向

- [ ] 添加实时数据更新（WebSocket 或 SSE）
- [ ] 更多事件类型（滚动、表单提交等）
- [ ] 会话追踪（Session Tracking）
- [ ] 漏斗分析（Funnel Analysis）
- [ ] 自定义日期范围
- [ ] 导出 CSV 功能