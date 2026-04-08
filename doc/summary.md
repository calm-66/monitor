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

---

## 数据获取方式

Monitor 平台支持两种数据获取方式，分别适用于不同的使用场景：

### 1. Client-side Tracking（客户端追踪）

**定义**：通过在用户浏览器中运行的 JavaScript 脚本（monitor.js）收集用户行为数据，并通过 HTTP Beacon（fetch/XHR）发送到 Monitor 后端。

**别名**：
- Frontend Instrumentation（前端埋点）
- JavaScript Tracking（JS 追踪）
- Beacon-based Collection（信标采集）

**数据流向**：
```
用户浏览器 → monitor.js → /api/events → Monitor Database
```

**收集的数据类型**：
- 页面浏览（Pageview）
- 点击事件（Click Event）
- 自定义事件（Custom Event）
- 设备信息（User-Agent、屏幕尺寸）
- 匿名用戶 ID（localStorage 生成）
- IP 地址（服务端从请求头提取）
- 地理位置（服务端调用 ip-api.com 解析）

**适用场景**：
- 用户行为分析（浏览、点击、停留时间）
- 流量统计（PV、UV）
- 来源分析（Referrer、地理位置）
- 会话追踪

**业界参考**：
- Google Analytics (gtag.js)
- Mixpanel
- Amplitude
- Hotjar

---

### 2. Server-side Integration（服务端集成）

**定义**：Monitor 后端通过调用外部 API（statsApiUrl）或接收 Webhook，从业务服务器获取业务数据。

**别名**：
- API-based Integration（API 集成）
- Backend Data Sync（后端数据同步）
- External Data Source（外部数据源）

**数据流向**：
```
Monitor Dashboard → statsApiUrl → 业务系统 API → 业务数据库
                        ↓
                   Monitor Database (聚合显示)
```

**收集的数据类型**：
- 注册用户数（Registered Users）
- 业务指标（发帖数、评论数、订单数等）
- 自定义业务统计

**适用场景**：
- 业务数据存储在服务端数据库中
- 需要聚合统计的业务指标
- 与用户行为无关的业务数据

**业界参考**：
- Segment（数据集成平台）
- Fivetran（数据管道）
- Stitch Data

---

### 3. 对比总结

| 维度 | Client-side Tracking | Server-side Integration |
|------|---------------------|------------------------|
| **数据来源** | 浏览器/客户端 | 业务数据库 |
| **数据类型** | 行为数据（浏览、点击） | 业务数据（用户、订单） |
| **数据流向** | Push（客户端推送） | Pull（Monitor 拉取） |
| **实时性** | 近实时 | 取决于调用频率 |
| **可靠性** | 受广告拦截器影响 | 更可靠 |
| **数据量** | 大（每次交互） | 小（聚合数据） |
| **实现复杂度** | 低（嵌入脚本） | 中（API 开发） |

---

### 4. 架构模式

```
                    ┌─────────────────┐
                    │   Monitor       │
                    │   Dashboard     │
                    └────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────────┐     │     ┌────────────────┐
     │  Client-side   │     │     │  Server-side   │
     │  Tracking      │     │     │  Integration   │
     │  (monitor.js)  │     │     │  (External API)│
     └────────────────     │     └────────────────
              │              │              │
              │              │              │
              ▼              ▼              ▼
     ┌─────────────────────────────────────────┐
     │           Monitor Database              │
     │  (Event 表 + 外部数据聚合)               │
     └─────────────────────────────────────────┘
```

这种架构结合了两种数据获取方式的优势：
- **Client-side Tracking**：捕捉实时用户行为，无需修改业务代码
- **Server-side Integration**：集成业务数据，提供更全面的分析视角

---

### 5. 使用建议

| 需求 | 推荐方案 |
|------|---------|
| 页面浏览量统计 | Client-side Tracking |
| 用户点击热图 | Client-side Tracking |
| 停留时间分析 | Client-side Tracking |
| 注册用户数显示 | Server-side Integration |
| 发帖/评论统计 | Server-side Integration |
| 订单转化追踪 | 两者结合（行为 + 业务） |
