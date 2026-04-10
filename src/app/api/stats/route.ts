import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log, formatAsBeijingDate } from '@/lib/utils';
import { StatsResponse } from '@/types/monitor';

/**
 * GET /api/stats
 * 获取统计数据
 * 查询参数：projectId, startDate, endDate
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    
    // 验证必填参数
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }
    
    // 验证 API Key
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing X-API-Key header' },
        { status: 401 }
      );
    }
    
    // 验证项目和 API Key
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        apiKey: apiKey,
        isActive: true
      }
    });
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or Project ID' },
        { status: 401 }
      );
    }
    
    // 解析日期范围
    const { start, end } = parseDateRange(startDate, endDate);
    
    // 获取总 PV
    const totalViewsResult = await prisma.event.aggregate({
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });
    
    // 获取 UV（按 userId 去重）
    const uniqueVisitorsResult = await prisma.event.findMany({
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        userId: { not: null }
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });
    
    // 按城市/地区分组统计（用于饼图）- 使用 groupBy 直接按 city, region, country 分组
    const viewsByRegionResult = await prisma.event.groupBy({
      by: ['city', 'region', 'country'],
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10 // 限制前 10 个地区
    });
    
    // 按国家分组统计（保留原有逻辑用于其他展示）
    const viewsByCountryResult = await prisma.event.groupBy({
      by: ['country'],
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 20 // 限制前 20 个国家
    });
    
    // 按日期分组统计 PV（最近 30 天，使用北京时间）
    const viewsByDayResult = await prisma.event.groupBy({
      by: ['createdAt'],
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // 按日期分组 PV（使用北京时间转换）
    const viewsByDayMap = new Map<string, number>();
    viewsByDayResult.forEach((item: { createdAt: Date; _count: { id: number } }) => {
      const beijingDate = formatAsBeijingDate(item.createdAt);
      viewsByDayMap.set(beijingDate, (viewsByDayMap.get(beijingDate) || 0) + item._count.id);
    });
    
    const viewsByDay = Array.from(viewsByDayMap.entries()).map(([date, count]) => ({
      date,
      count
    }));
    
    // 计算当天 PV（使用北京时间）
    const today = formatAsBeijingDate(new Date());
    const todayPV = viewsByDay.find(item => item.date === today)?.count || 0;
    
    // 处理地区数据（用于饼图）- 优先使用城市，其次使用地区，最后使用国家
    const viewsByRegion = viewsByRegionResult
      .map((item: { city: string | null; region: string | null; country: string | null; _count: { id: number } }) => {
        let regionName = item.city || item.region || item.country || 'Unknown';
        // 移除省份后缀（如"上海市"->"上海"），避免重复
        if (regionName && regionName.endsWith('市') && regionName.length > 2) {
          regionName = regionName.slice(0, -1);
        }
        return {
          name: regionName,
          count: item._count.id
        };
      })
      .filter(item => item.name !== 'Unknown'); // 过滤掉 Unknown 地区
    
    // 按城市/地区分组统计已登录用户事件（用于饼图）- 使用 groupBy 直接按 city, region, country 分组
    const activeUsersByRegionResult = await prisma.event.groupBy({
      by: ['city', 'region', 'country'],
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        userId: { not: null } // 只统计有 userId 的事件（已登录用户）
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10 // 限制前 10 个地区
    });
    
    // 处理已登录用户地区数据（用于饼图）- 优先使用城市，其次使用地区，最后使用国家
    const activeUsersByRegion = activeUsersByRegionResult
      .map((item: { city: string | null; region: string | null; country: string | null; _count: { id: number } }) => {
        let regionName = item.city || item.region || item.country || 'Unknown';
        // 移除省份后缀（如"上海市"->"上海"），避免重复
        if (regionName && regionName.endsWith('市') && regionName.length > 2) {
          regionName = regionName.slice(0, -1);
        }
        return {
          name: regionName,
          count: item._count.id
        };
      })
      .filter(item => item.name !== 'Unknown'); // 过滤掉 Unknown 地区
    
    // 按日期分组统计 UV（最近 30 天，使用北京时间）
    // 获取所有有 userId 的事件记录
    const eventsWithUserId = await prisma.event.findMany({
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        userId: { not: null }
      },
      select: {
        userId: true,
        createdAt: true
      }
    });
    
    // 按北京时间日期分组，统计每天的独立访客数（去重 userId）
    const uniqueVisitorsByDayMap = new Map<string, Set<string>>();
    eventsWithUserId.forEach((event) => {
      const beijingDate = formatAsBeijingDate(event.createdAt);
      if (!uniqueVisitorsByDayMap.has(beijingDate)) {
        uniqueVisitorsByDayMap.set(beijingDate, new Set());
      }
      uniqueVisitorsByDayMap.get(beijingDate)!.add(event.userId!);
    });
    
    const uniqueVisitorsByDay = Array.from(uniqueVisitorsByDayMap.entries()).map(([date, userIdSet]) => ({
      date,
      count: userIdSet.size
    }));
    
    // 热门页面排行
    const topPagesResult = await prisma.event.groupBy({
      by: ['pageUrl'],
      _count: {
        id: true
      },
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        pageUrl: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10 // 限制前 10 个页面
    });
    
    // 获取 IP 解析限制统计
    const ipLimitStats = await prisma.ipLimitTracker.findMany({
      where: {
        projectId,
        date: {
          gte: startDate || new Date().toISOString().split('T')[0]
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: 30 // 最近 30 天
    });
    
    // 汇总 IP 限制统计
    const totalRequests = ipLimitStats.reduce((sum: number, stat: { totalRequests: number }) => sum + stat.totalRequests, 0);
    const successfulResolves = ipLimitStats.reduce((sum: number, stat: { successfulResolves: number }) => sum + stat.successfulResolves, 0);
    const rateLimitedCount = ipLimitStats.reduce((sum: number, stat: { rateLimitedCount: number }) => sum + stat.rateLimitedCount, 0);
    const failedCount = ipLimitStats.reduce((sum: number, stat: { failedCount: number }) => sum + stat.failedCount, 0);
    const rateLimitedRatio = totalRequests > 0 ? rateLimitedCount / totalRequests : 0;
    
    // 构建响应数据
    const stats: StatsResponse = {
      totalViews: totalViewsResult._count.id,
      uniqueVisitors: uniqueVisitorsResult.length,
      viewsByCountry: viewsByCountryResult.map((item: { country: string | null; _count: { id: number } }) => ({
        country: item.country || 'Unknown',
        count: item._count.id
      })),
      viewsByDay,
      uniqueVisitorsByDay,
      topPages: topPagesResult.map((item: { pageUrl: string | null; _count: { id: number } }) => ({
        page: item.pageUrl || 'Unknown',
        count: item._count.id
      })),
      ipResolveStats: {
        totalRequests,
        successfulResolves,
        rateLimitedCount,
        failedCount,
        rateLimitedRatio
      },
      todayPV,
      viewsByRegion,
      activeUsersByRegion
    };
    
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    log('error', 'Failed to fetch stats', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}