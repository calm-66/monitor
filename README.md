# Monitor Platform

一个全栈 Serverless 监控平台，用于监控多个项目的用户行为。首期实现用户访问统计和 IP 地理来源分析功能。

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript
- **样式**: Tailwind CSS
- **图表**: Recharts
- **数据库**: Neon PostgreSQL
- **ORM**: Prisma
- **部署**: Vercel

## 功能特性

### 首期功能
- ✅ 多租户项目管理（Project + API Key 隔离）
- ✅ 数据采集（页面浏览、自定义事件）
- ✅ IP 地理位置解析（ip-api.com，45 次/分钟限流）
- ✅ 基础 Dashboard（PV/UV 统计、地区分布）
- ✅ HTTP Basic Auth 保护 Dashboard
- ✅ 前端批量上报脚本（1 分钟间隔 + 重试机制）
- ✅ CORS 跨域配置
- ✅ 健康检查端点

### IP 解析限流处理
- 使用 ip-api.com 免费服务（45 次/分钟）
- 超出限制时记录到 `IpLimitTracker` 表
- Dashboard 显示警告但不阻止事件存储

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库连接字符串 (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Dashboard 访问密码
DASHBOARD_PASSWORD="your_secure_password_here"

# 可选：允许的 CORS 域名
ALLOWED_ORIGINS="https://usonly.com"
```

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 推送 schema 到数据库（开发环境）
npm run db:push

# 或者运行迁移（生产环境）
npm run db:migrate
```

### 4. 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
monitor-platform/
├── prisma/
│   └── schema.prisma          # 数据库模型
├── public/
│   └── monitor.js             # 前端采集脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── projects/      # 项目管理 API
│   │   │   ├── events/        # 事件上报 API
│   │   │   ├── stats/         # 统计数据 API
│   │   │   └── health/        # 健康检查 API
│   │   ├── dashboard/
│   │   │   └── [projectId]/   # Dashboard 页面
│   │   ├── layout.tsx         # 根布局
│   │   ├── page.tsx           # 首页（项目列表）
│   │   └── globals.css        # 全局样式
│   ├── lib/
│   │   ├── prisma.ts          # Prisma 客户端
│   │   ├── geoip.ts           # IP 地理位置解析
│   │   ├── auth.ts            # HTTP Basic Auth
│   │   └── utils.ts           # 工具函数
│   └── types/
│       └── monitor.ts         # TypeScript 类型定义
├── .env.example               # 环境变量示例
├── package.json
└── README.md
```

## API 接口

### 项目管理

#### `POST /api/projects`
创建新项目
```json
// 请求
{
  "name": "my-project",
  "description": "Optional description",
  "domain": "https://example.com"
}

// 响应
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "my-project",
      "apiKey": "mk_xxx..."
    }
  }
}
```

#### `GET /api/projects`
获取项目列表

#### `GET /api/projects/[projectId]`
获取单个项目详情

#### `DELETE /api/projects/[projectId]`
删除项目（级联删除关联事件）

### 事件上报

#### `POST /api/events`
接收事件上报（支持批量）

请求头：
- `X-API-Key`: 项目 API Key
- `X-Project-ID`: 项目 ID

请求体（单个或数组）：
```json
{
  "eventType": "pageview",
  "pageUrl": "https://example.com/page",
  "pageTitle": "Page Title",
  "userId": "user_abc123",
  "screenWidth": 1920,
  "screenHeight": 1080
}
```

### 统计数据

#### `GET /api/stats`
获取统计数据

查询参数：
- `projectId`: 项目 ID（必填）
- `startDate`: 开始日期（可选，默认 30 天前）
- `endDate`: 结束日期（可选，默认今天）

请求头：
- `X-API-Key`: 项目 API Key

响应：
```json
{
  "success": true,
  "data": {
    "totalViews": 1000,
    "uniqueVisitors": 500,
    "viewsByCountry": [{"country": "United States", "count": 300}],
    "viewsByDay": [{"date": "2024-01-01", "count": 50}],
    "topPages": [{"page": "/home", "count": 200}],
    "ipResolveStats": {
      "totalRequests": 1000,
      "successfulResolves": 950,
      "rateLimitedCount": 40,
      "failedCount": 10,
      "rateLimitedRatio": 0.04
    }
  }
}
```

### 健康检查

#### `GET /api/health`
健康检查端点

## 前端集成

### 方式 1：手动初始化

```html
<script src="https://your-monitor-platform.com/monitor.js"></script>
<script>
  Monitor.init({
    projectId: 'your-project-id',
    apiKey: 'your-api-key',
    endpoint: 'https://your-monitor-platform.com/api/events'
  });
</script>
```

### 方式 2：自动初始化（data 属性）

```html
<script 
  src="https://your-monitor-platform.com/monitor.js"
  data-project-id="your-project-id"
  data-api-key="your-api-key"
  data-endpoint="https://your-monitor-platform.com/api/events"
></script>
```

### API 方法

```javascript
// 初始化
Monitor.init({ projectId, apiKey, endpoint, batchSize, flushInterval });

// 追踪页面浏览
Monitor.trackPageview();

// 追踪自定义事件
Monitor.trackEvent('button_click', { button: 'signup' });

// 追踪点击
Monitor.trackClick('.btn', 'button_clicked');

// 手动刷新
Monitor.flush();

// 销毁
Monitor.destroy();
```

## 部署到 Vercel

### 1. 创建 Neon PostgreSQL 数据库

1. 访问 https://neon.tech
2. 创建新项目
3. 获取连接字符串

### 2. 配置 Vercel 环境变量

在 Vercel 项目设置中添加：

```
DATABASE_URL=postgresql://...
DASHBOARD_PASSWORD=your_secure_password
```

### 3. 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

### 4. 运行数据库迁移

部署后在 Vercel 中配置自动运行迁移，或手动执行：

```bash
npm run db:generate
npm run db:push
```

## 数据库模型

### Project 表
- `id`: UUID 主键
- `name`: 项目名称（唯一）
- `apiKey`: API Key（唯一）
- `description`: 描述
- `domain`: 域名
- `isActive`: 是否启用

### Event 表
- `id`: cuid 主键
- `projectId`: 所属项目 ID
- `eventType`: 事件类型
- `pageUrl`, `pageTitle`, `referrer`: 页面信息
- `userId`: 匿名用户 ID
- `ipAddress`: IP 地址
- `country`, `region`, `city`, `latitude`, `longitude`: 地理位置
- `deviceType`, `browser`, `os`: 设备信息
- `screenWidth`, `screenHeight`: 屏幕信息
- `createdAt`: 创建时间

### IpLimitTracker 表
- `projectId`: 项目 ID
- `date`: 日期（YYYY-MM-DD）
- `totalRequests`: 总请求数
- `successfulResolves`: 成功解析数
- `rateLimitedCount`: 被限流次数
- `failedCount`: 失败次数

## 安全考虑

- API Key 用于认证，应保密
- Dashboard 使用 HTTP Basic Auth 保护
- CORS 配置限制跨域访问
- 敏感信息通过环境变量管理，不硬编码

## 性能优化

- 事件批量上报（默认 10 条或 1 分钟）
- 前端失败重试（指数退避）
- 数据库索引优化（projectId + createdAt 复合索引）

## 开发命令

```bash
# 开发服务器
npm run dev

# 构建
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint

# 数据库命令
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## License

MIT