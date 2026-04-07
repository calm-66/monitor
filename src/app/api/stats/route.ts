import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log } from '@/lib/utils';
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
    
    // 按国家分组统计
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
    
    // 按日期分组统计（最近 30 天）
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
    
    // 按日期分组（需要手动处理，因为 Prisma 不支持 DATE_TRUNC）
    const viewsByDayMap = new Map<string, number>();
    viewsByDayResult.forEach((item: { createdAt: Date; _count: { id: number } }) => {
      const dateKey = item.createdAt.toISOString().split('T')[0];
      viewsByDayMap.set(dateKey, (viewsByDayMap.get(dateKey) || 0) + item._count.id);
    });
    
    const viewsByDay = Array.from(viewsByDayMap.entries()).map(([date, count]) => ({
      date,
      count
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
    const totalRequests = ipLimitStats.reduce((sum, stat) => sum + stat.totalRequests, 0);
    const successfulResolves = ipLimitStats.reduce((sum, stat) => sum + stat.successfulResolves, 0);
    const rateLimitedCount = ipLimitStats.reduce((sum, stat) => sum + stat.rateLimitedCount, 0);
    const failedCount = ipLimitStats.reduce((sum, stat) => sum + stat.failedCount, 0);
    const rateLimitedRatio = totalRequests > 0 ? rateLimitedCount / totalRequests : 0;
    
    // 构建响应数据
    const stats: StatsResponse = {
      totalViews: totalViewsResult._count.id,
      uniqueVisitors: uniqueVisitorsResult.length,
      viewsByCountry: viewsByCountryResult.map(item => ({
        country: item.country,
        count: item._count.id
      })),
      viewsByDay,
      topPages: topPagesResult.map(item => ({
        page: item.pageUrl || 'Unknown',
        count: item._count.id
      })),
      ipResolveStats: {
        totalRequests,
        successfulResolves,
        rateLimitedCount,
        failedCount,
        rateLimitedRatio
      }
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