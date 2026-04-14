# 登录事件追踪集成文档

## 概述

本文档说明如何将 UsOnly 项目的用户登录事件（包括手动登录和 localStorage 自动登录）集成到 Monitor 平台进行追踪，以获取详细的登录统计信息，包括：

- 登录的城市、地区、国家
- 设备类型（desktop/mobile/tablet）
- 浏览器和操作系统
- 当地时间（由客户端发送）
- 屏幕分辨率等

## 架构设计

### 数据流程

```
UsOnly 客户端 (登录成功) 
       ↓
   monitor.ts (trackLogin)
       ↓
   Monitor API /api/events
       ↓
   Event 表 (eventName: 'login')
       ↓
   Monitor API /api/logins (统计查询)
```

### 关键组件

1. **UsOnly 项目**
   - `src/lib/monitor.ts` - Monitor 集成工具库
   - `src/app/page.tsx` - 登录页面，集成登录事件上报

2. **Monitor 项目**
   - `src/app/api/events/route.ts` - 事件接收 API
   - `src/app/api/logins/route.ts` - 登录统计 API
   - `src/types/monitor.ts` - 类型定义（包含 login 事件类型）

## 配置说明

### UsOnly 项目配置

在 `.env` 文件中配置 Monitor 连接信息：

```env
# Monitor 项目 ID（在 Monitor 后台创建项目后获取）
NEXT_PUBLIC_MONITOR_PROJECT_ID="your-project-id-here"

# Monitor API Key（用于上报监控数据）
NEXT_PUBLIC_MONITOR_API_KEY="your-api-key-here"

# Monitor 事件上报端点
NEXT_PUBLIC_MONITOR_ENDPOINT="https://monitor-your-domain.vercel.app/api/events"
```

## 使用方法

### 1. 在 UsOnly 中初始化 Monitor

```typescript
import { initMonitor, trackLogin } from '@/lib/monitor'

// 在页面加载时初始化
useEffect(() => {
  initMonitor()
}, [])
```

### 2. 在登录成功时上报事件

```typescript
// 手动登录成功
trackLogin(user.id, user.username)

// 自动登录成功
trackLogin(user.id, user.username)

// 注册成功
trackLogin(user.id, user.username)
```

### 3. 查询登录统计数据

调用 Monitor 的 `/api/logins` API 获取登录统计：

```bash
GET /api/logins?projectId=xxx&startDate=2024-01-01&endDate=2024-12-31
Headers:
  X-API-Key: your-api-key
```

响应示例：

```json
{
  "success": true,
  "data": {
    "totalLogins": 1500,
    "uniqueLoginUsers": 300,
    "loginsByDay": [
      { "date": "2024-01-01", "count": 50 }
    ],
    "uniqueUsersByDay": [
      { "date": "2024-01-01", "count": 30 }
    ],
    "loginsByCity": [
      { "city": "上海", "count": 500 }
    ],
    "loginsByDevice": [
      { "deviceType": "desktop", "count": 800 },
      { "deviceType": "mobile", "count": 700 }
    ],
    "loginsByBrowser": [
      { "browser": "Chrome", "count": 1000 }
    ],
    "loginsByOS": [
      { "os": "Windows", "count": 900 }
    ],
    "recentLogins": [...]
  }
}
```

## 事件数据结构

登录事件发送到 Monitor 的数据结构：

```typescript
{
  eventType: 'custom',
  eventName: 'login',
  pageUrl: string,
  userAgent: string,
  screenWidth: number,
  screenHeight: number,
  userId: `user_${usOnlyUserId}`,  // 添加前缀区分
  createdAt: ISO8601_string,  // 包含时区信息
  metadata: {
    usOnlyUserId: string,
    username: string,
    eventType: 'user_login'
  }
}
```

## 安全考虑

1. **API Key 保护**: API Key 通过环境变量配置，不在代码中硬编码
2. **项目隔离**: 每个项目有独立的 API Key 和 Project ID
3. **批量限制**: 单次请求最多 100 个事件，防止滥用
4. **API Key 验证**: 所有请求必须通过 API Key 验证，这是主要的安全机制

## 数据库迁移

本集成复用现有的 Event 表结构，无需数据库迁移。

如需查询登录事件：

```sql
-- 查询所有登录事件
SELECT * FROM "Event" 
WHERE "eventName" = 'login' 
AND "projectId" = 'your-project-id'
ORDER BY "createdAt" DESC;

-- 按城市统计登录次数
SELECT "city", COUNT(*) as login_count 
FROM "Event" 
WHERE "eventName" = 'login'
GROUP BY "city"
ORDER BY login_count DESC;
```

## 相关文件

- `Monitor/src/lib/monitor.ts` - 不存在，这是 UsOnly 的工具库
- `Monitor/src/app/api/logins/route.ts` - 登录统计 API
- `Monitor/src/types/monitor.ts` - 类型定义
- `UsOnly/src/lib/monitor.ts` - Monitor 集成工具
- `UsOnly/src/app/page.tsx` - 登录页面集成