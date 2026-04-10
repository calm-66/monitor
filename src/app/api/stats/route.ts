import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log, formatAsBeijingDate } from '@/lib/utils';
import { StatsResponse } from '@/types/monitor';

/**
 * GET /api/stats
 * 获取统计数据
 * 查询参数：projectId, startDate, endDate, domain
 * 
 * domain 参数：直接传入域名（如 'usonly-preview.vercel.app' 或 'usonly.com'）
 * 前端根据用户选择的环境（preview/production）传入对应的域名
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const domain = searchParams.get('domain') || ''; // 直接传入域名
    
    // 验证必填参数
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    // 构建域名筛选条件
    const environmentFilter: any = {};
    if (domain) {
      // 直接使用传入的域名进行筛选
      environmentFilter.pageUrl = { contains: domain };
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
        },
        ...environmentFilter
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
        userId: { not: null },
        ...environmentFilter
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
        },
        ...environmentFilter
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 20 // 限制前 20 个国家
    });
    
    // 按日期分组统计（最近 30 天，使用北京时间）
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
        },
        ...environmentFilter
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // 按日期分组（使用北京时间转换）
    // 逻辑：只要记录的 createdAt 转换为北京时间后是当天，就认为是当天的访问
    const viewsByDayMap = new Map<string, number>();
    viewsByDayResult.forEach((item: { createdAt: Date; _count: { id: number } }) => {
      // 使用北京时间日期作为分组 key
      const beijingDate = formatAsBeijingDate(item.createdAt);
      viewsByDayMap.set(beijingDate, (viewsByDayMap.get(beijingDate) || 0) + item._count.id);
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
        pageUrl: { not: null },
        ...environmentFilter
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