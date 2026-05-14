import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log, formatAsBeijingDate } from '@/lib/utils';
import { IpResolveStats } from '@/types/monitor';
import { StatsResponse } from '@/types/monitor';

// 简单的 CORS 头（允许所有来源）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getCanonicalUserId(event: { userId: string | null; metadata?: unknown }, userIdAliases?: Map<string, string>): string | null {
  const usOnlyUserId = getMetadataString(event.metadata, 'usOnlyUserId');
  if (usOnlyUserId) return `user_${usOnlyUserId}`;
  if (event.userId && userIdAliases?.has(event.userId)) return userIdAliases.get(event.userId)!;
  return event.userId || null;
}

function buildUserIdAliases(events: Array<{ userId: string | null; metadata?: unknown }>): Map<string, string> {
  const aliases = new Map<string, string>();

  events.forEach((event) => {
    const monitorUserId = getMetadataString(event.metadata, 'monitorUserId');
    const usOnlyUserId = getMetadataString(event.metadata, 'usOnlyUserId');
    if (!monitorUserId || !usOnlyUserId) return;

    aliases.set(monitorUserId, `user_${usOnlyUserId}`);
  });

  return aliases;
}

// 处理 OPTIONS 预检请求
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

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
    
    // 获取 UV 原始事件，后续按 canonical user key 去重：
    // 登录后优先使用真实 usOnlyUserId，未登录 fallback 到 monitor_user_id。
    const uniqueVisitorEvents = await prisma.event.findMany({
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
        metadata: true,
        createdAt: true,
        city: true,
        region: true,
        country: true
      }
    });
    const userIdAliases = buildUserIdAliases(uniqueVisitorEvents);
    const uniqueVisitorIds = new Set<string>();
    uniqueVisitorEvents.forEach((event) => {
      const canonicalUserId = getCanonicalUserId(event, userIdAliases);
      if (canonicalUserId) uniqueVisitorIds.add(canonicalUserId);
    });
    
    // 按地区分组，每个地区存储独立的 canonical user key 集合
    const regionUserMap = new Map<string, Set<string>>();
    uniqueVisitorEvents.forEach((event) => {
      const canonicalUserId = getCanonicalUserId(event, userIdAliases);
      if (!canonicalUserId) return;

      let regionName = event.city || event.region || event.country || 'Unknown';
      // 移除省份后缀（如"上海市"->"上海"），避免重复
      if (regionName && regionName.endsWith('市') && regionName.length > 2) {
        regionName = regionName.slice(0, -1);
      }
      if (regionName === 'Unknown') return;
      
      if (!regionUserMap.has(regionName)) {
        regionUserMap.set(regionName, new Set());
      }
      regionUserMap.get(regionName)!.add(canonicalUserId);
    });
    
    // 转换为数组并排序，取前 10 个地区
    const activeUsersByRegion = Array.from(regionUserMap.entries())
      .map(([name, userIdSet]) => ({
        name,
        count: userIdSet.size
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 按北京时间日期分组，统计每天的独立访客数（去重 canonical user key）
    const uniqueVisitorsByDayMap = new Map<string, Set<string>>();
    uniqueVisitorEvents.forEach((event) => {
      const canonicalUserId = getCanonicalUserId(event, userIdAliases);
      if (!canonicalUserId) return;

      const beijingDate = formatAsBeijingDate(event.createdAt);
      if (!uniqueVisitorsByDayMap.has(beijingDate)) {
        uniqueVisitorsByDayMap.set(beijingDate, new Set());
      }
      uniqueVisitorsByDayMap.get(beijingDate)!.add(canonicalUserId);
    });
    
    const uniqueVisitorsByDay = Array.from(uniqueVisitorsByDayMap.entries()).map(([date, userIdSet]) => ({
      date,
      count: userIdSet.size
    })).sort((a, b) => a.date.localeCompare(b.date)); // 按日期升序排序
    
    // 统计每日登录用户数（Daily Active Users）- 从 Event 表中筛选 login 事件
    // 获取所有登录事件（eventName: 'login'）
    const loginEvents = await prisma.event.findMany({
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        eventName: 'login',
        userId: { not: null }
      },
      select: {
        userId: true,
        createdAt: true
      }
    });
    
    // 按北京时间日期分组，统计每天登录的独立用户数（去重 userId）
    const dailyActiveUsersMap = new Map<string, Set<string>>();
    loginEvents.forEach((event) => {
      const beijingDate = formatAsBeijingDate(event.createdAt);
      if (!dailyActiveUsersMap.has(beijingDate)) {
        dailyActiveUsersMap.set(beijingDate, new Set());
      }
      dailyActiveUsersMap.get(beijingDate)!.add(event.userId!);
    });
    
    const dailyActiveUsers = Array.from(dailyActiveUsersMap.entries())
      .map(([date, userIdSet]) => ({
        date,
        count: userIdSet.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 按日期升序排序
    
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
    
    // IP 解析限制统计已删除，使用空数据
    const ipResolveStats: IpResolveStats = {
      totalRequests: 0,
      successfulResolves: 0,
      rateLimitedCount: 0,
      failedCount: 0,
      rateLimitedRatio: 0
    };
    
    // 构建响应数据
    const stats: StatsResponse = {
      uniqueVisitors: uniqueVisitorIds.size,
      uniqueVisitorsByDay,
      dailyActiveUsers,
      topPages: topPagesResult.map((item: { pageUrl: string | null; _count: { id: number } }) => ({
        page: item.pageUrl || 'Unknown',
        count: item._count.id
      })),
      ipResolveStats,
      activeUsersByRegion
    };
    
    return NextResponse.json({ success: true, data: stats }, { headers: corsHeaders });
  } catch (error) {
    log('error', 'Failed to fetch stats', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500, headers: corsHeaders }
    );
  }
}
