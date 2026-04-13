# Implementation Plan

## Overview

在 Monitor Dashboard 中添加注册用户数显示功能，采用标准化 API 接口方案实现与 UsOnly 项目的解耦。

## Scope

本实施包括两个项目的修改：
1. **Monitor 项目**：添加外部 API 配置和数据显示
2. **UsOnly 项目**：创建标准格式的用户统计 API

### 解耦设计原则
- Monitor 不依赖 UsOnly 的数据库结构
- UsOnly 只需遵循标准 API 响应格式
- 其他项目也可通过相同规范接入 Monitor
- API 调用失败不影响 Dashboard 其他功能

## Types

### Monitor 项目类型定义

**新增外部用户统计响应类型** (`src/types/monitor.ts`):
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

// StatsResponse 新增字段
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
  // 新增字段
  externalUserStats?: {
    totalUsers: number;
    newUsersToday?: number;
    newUsersThisWeek?: number;
    newUsersThisMonth?: number;
  };
}
```

**Project 模型新增字段** (`prisma/schema.prisma`):
```prisma
model Project {
  id           String    @id @default(uuid())
  name         String    @unique
  description  String?
  apiKey       String    @unique
  domain       String?
  statsApiUrl  String?   // 新增：外部统计 API 地址
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  events       Event[]
  ipLimitTrackers IpLimitTracker[]
}
```

## Files

### Monitor 项目文件修改

**1. 数据库 Schema** (`prisma/schema.prisma`)
- 修改：在 Project 模型中添加 `statsApiUrl String?` 字段

**2. 类型定义** (`src/types/monitor.ts`)
- 新增：`ExternalUserStats` 接口
- 修改：`StatsResponse` 接口添加 `externalUserStats` 字段

**3. Dashboard 页面** (`src/app/dashboard/[projectId]/page.tsx`)
- 修改：添加获取外部用户统计的逻辑
- 修改：在统计卡片中增加"注册用户数"显示

**4. 数据库迁移脚本** (`scripts/migrate.sql`)
- 新增：添加 `statsApiUrl` 字段的 ALTER TABLE 语句

### UsOnly 项目文件修改

**1. API 路由** (`src/app/api/monitor/stats/route.ts`)
- 新增：创建标准格式的用户统计 API

**2. 环境变量** (`.env.local` 或 Vercel 环境变量)
- 新增：`MONITOR_API_KEY`（可选，用于认证）

## Functions

### Monitor 项目函数修改

**Dashboard 页面新增函数** (`src/app/dashboard/[projectId]/page.tsx`):
```typescript
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

// 在 loadStats 中合并调用
const loadStats = useCallback(async () => {
  // ... 原有逻辑
  const externalStats = await loadExternalUserStats();
  setStats(prev => prev ? { ...prev, externalUserStats: externalStats } : null);
}, [loadExternalUserStats]);
```

### UsOnly 项目新增函数

**用户统计 API** (`src/app/api/monitor/stats/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // 可选的 API Key 认证
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = process.env.MONITOR_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取用户统计
    const totalUsers = await prisma.user.count();
    
    // 今日开始时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 本周开始时间（周一）
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    
    // 本月开始时间
    const monthStart = new Date(today);
    monthStart.setDate(1);

    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: today } }
    });
    
    const newUsersThisWeek = await prisma.user.count({
      where: { createdAt: { gte: weekStart } }
    });
    
    const newUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: monthStart } }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth
      }
    });
  } catch (error) {
    console.error('Error in /api/monitor/stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Classes

本项目不涉及类的修改。

## Dependencies

### Monitor 项目
- 无新增依赖

### UsOnly 项目
- 无新增依赖（使用已有的 Prisma 和 Next.js）

## Testing

### Monitor 项目测试

1. **数据库迁移测试**
   - 在本地执行 `npx prisma migrate dev` 验证 schema 修改
   - 验证 `statsApiUrl` 字段可正常读写

2. **API 调用测试**
   - 配置测试项目的 `statsApiUrl`
   - 验证 Dashboard 可正确获取并显示外部数据
   - 验证 API 调用失败时不影响其他功能

3. **UI 测试**
   - 验证"注册用户数"卡片正确显示
   - 验证无外部 API 配置时的降级显示

### UsOnly 项目测试

1. **API 端点测试**
   - 直接访问 `/api/monitor/stats` 验证响应格式
   - 验证 API Key 认证（如配置）
   - 验证用户数统计准确性

2. **集成测试**
   - 在 Monitor 中配置 UsOnly 的 API 地址
   - 验证 Dashboard 显示正确数据

## Implementation Order

### 阶段 1: Monitor 项目数据库修改
1. 修改 `prisma/schema.prisma`，添加 `statsApiUrl` 字段
2. 生成并审查数据库迁移脚本
3. 执行数据库迁移

### 阶段 2: Monitor 类型定义更新
4. 修改 `src/types/monitor.ts`，添加 `ExternalUserStats` 类型
5. 修改 `StatsResponse` 接口

### 阶段 3: UsOnly API 创建
6. 在 UsOnly 项目中创建 `src/app/api/monitor/stats/route.ts`
7. 配置环境变量 `MONITOR_API_KEY`（可选）
8. 测试 API 端点

### 阶段 4: Monitor Dashboard 更新
9. 修改 `src/app/dashboard/[projectId]/page.tsx`
   - 添加获取外部用户统计的逻辑
   - 在 UI 中显示"注册用户数"卡片
10. 测试完整流程

### 阶段 5: 配置与部署
11. 在 Monitor Dashboard 中配置项目的 `statsApiUrl`
12. 推送 Monitor 项目到 GitHub
13. 推送 UsOnly 项目到 GitHub
14. 等待 Vercel 部署完成
15. 验证生产环境功能

### 阶段 6: 文档更新
16. 更新 `doc/summary.md`
17. 生成新的数据库迁移 SQL 脚本