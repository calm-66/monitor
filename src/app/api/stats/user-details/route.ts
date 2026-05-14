import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log, getTimezoneOffset, convertUTCToLocalTime, parseBeijingDateRange } from '@/lib/utils';

// 简单的 CORS 头（允许所有来源）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}


/**
 * 简化设备分类：PC / iPhone / Android
 */
function categorizeDevice(deviceType: string | null, os: string | null): string {
  const osLower = os?.toLowerCase() || '';
  const type = deviceType?.toLowerCase() || '';
  
  if (type === 'desktop') return 'PC';
  if (osLower.includes('iphone') || osLower.includes('ios')) return 'iPhone';
  if (osLower.includes('android')) return 'Android';
  if (type === 'mobile') return 'Mobile';
  if (type === 'tablet') return 'Tablet';
  return 'Other';
}

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

/**
 * GET /api/stats/user-details
 * 获取用户详细信息列表
 * 查询参数：projectId, startDate, endDate, type (uv/active), date (可选，指定日期)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const region = searchParams.get('region') || undefined;
    const type = searchParams.get('type') || 'uv'; // 'uv' 或 'active'
    const date = searchParams.get('date'); // 可选，指定具体日期

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
    let start: Date;
    let end: Date;
    
    if (date) {
      // 如果指定了日期，使用北京时间解析（与统计 API 保持一致）
      // 这确保了统计数据和详情列表使用相同的时间范围
      const beijingRange = parseBeijingDateRange(date);
      start = beijingRange.start;
      end = beijingRange.end;
    } else {
      // 否则使用 startDate 和 endDate（默认使用本地时间）
      const parsed = parseDateRange(startDate, endDate);
      start = parsed.start;
      end = parsed.end;
    }

    // 解析页面路径（只保留 pathname，不包含域名）
    function parsePagePath(url: string | null): string {
      if (!url) return '-';
      try {
        // 尝试解析 URL，只返回 pathname 部分
        const parsed = new URL(url);
        return parsed.pathname;
      } catch {
        // 如果 URL 格式无效，返回原始字符串或 '-'
        return url || '-';
      }
    }

    function normalizeRegionName(event: { city: string | null; region?: string | null; country: string | null }): string {
      let regionName = event.city || event.region || event.country || 'Unknown';
      if (regionName && regionName.endsWith('市') && regionName.length > 2) {
        regionName = regionName.slice(0, -1);
      }
      return regionName;
    }

    function buildRegionWhere(regionName?: string) {
      if (!regionName) return {};
      return {
        OR: [
          { city: regionName },
          { city: `${regionName}市` },
          { region: regionName },
          { region: `${regionName}市` },
          { country: regionName }
        ]
      };
    }

    // 根据 type 参数采用不同的查询策略
    let events: any[] = [];
    
    if (type === 'active') {
      // 步骤 1: 先查询 login 事件，获取活跃用户列表（去重后的 userId）
      const loginWhereCondition: any = {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        },
        userId: { not: null }
      };
      
      const loginEvents = await prisma.event.findMany({
        where: loginWhereCondition,
        select: {
          userId: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // 获取有 login 事件的 userId 列表（去重）
      const activeUserIds = Array.from(new Set(loginEvents.map(e => e.userId)));
      
      // 步骤 2: 查询这些活跃用户的所有事件（用于获取页面访问记录）
      if (activeUserIds.length > 0) {
        const allEventsWhereCondition: any = {
          projectId,
          userId: { in: activeUserIds },
          createdAt: {
            gte: start,
            lte: end
          },
          ...buildRegionWhere(region)
        };
        
        events = await prisma.event.findMany({
          where: allEventsWhereCondition,
          select: {
            userId: true,
            city: true,
            region: true,
            country: true,
            deviceType: true,
            os: true,
            browser: true,
            createdAt: true,
            pageUrl: true,
            metadata: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 500
        });
      }
    } else {
      // type='uv' 时查询所有事件
      const whereCondition: any = {
        projectId,
        createdAt: {
          gte: start,
          lte: end
        },
        userId: { not: null },
        ...buildRegionWhere(region)
      };
      
      events = await prisma.event.findMany({
        where: whereCondition,
        select: {
          userId: true,
          city: true,
          region: true,
          country: true,
          deviceType: true,
          os: true,
          browser: true,
          createdAt: true,
          pageUrl: true,
          metadata: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 500
      });
    }

    // 按用户 key 分组：UV 使用 canonical user key，Active Users 保持 login userId 口径。
    const userIdAliases = type === 'uv' ? buildUserIdAliases(events) : new Map<string, string>();
    const userPageVisits = new Map<string, Map<string, number>>();
    const userEvents = new Map<string, typeof events[0]>(); // 保留每个用户的最新事件（用于其他字段）
    
    events.forEach(event => {
      const userId = type === 'uv' ? getCanonicalUserId(event, userIdAliases) : event.userId;
      if (!userId) return;
      
      // 保留最新事件用于获取城市、设备等信息
      if (!userEvents.has(userId)) {
        userEvents.set(userId, event);
      }
      
      // 统计页面访问次数
      const pagePath = parsePagePath(event.pageUrl);
      if (!userPageVisits.has(userId)) {
        userPageVisits.set(userId, new Map<string, number>());
      }
      const pageMap = userPageVisits.get(userId)!;
      pageMap.set(pagePath, (pageMap.get(pagePath) || 0) + 1);
    });

    // 获取用户最近访问的页面（按时间排序，取最后一个访问的页面）
    function getLatestPage(pageVisits: Map<string, number>, userId: string): string {
      // 获取该用户的所有事件，按时间排序
      const userEventsList = events
        .filter(e => (type === 'uv' ? getCanonicalUserId(e, userIdAliases) : e.userId) === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      // 返回最近访问的页面（有 pageUrl 且不是 login 事件的）
      for (const event of userEventsList) {
        const pagePath = parsePagePath(event.pageUrl);
        if (pagePath !== '-' && pagePath !== '/') {
          return pagePath;
        }
      }
      
      // 如果没有其他页面，返回第一个（可能是 '/'）
      return userEventsList.length > 0 ? parsePagePath(userEventsList[0].pageUrl) : '-';
    }

    // 构建用户详细信息
    const userDetails = Array.from(userEvents.entries()).map(([userId, event]) => {
      const offset = getTimezoneOffset(event.city, event.country);
      const localTime = convertUTCToLocalTime(event.createdAt, offset);
      const device = categorizeDevice(event.deviceType, event.os);
      
      // 获取该用户最近访问的页面
      const pageVisits = userPageVisits.get(userId);
      const latestPage = pageVisits ? getLatestPage(pageVisits, userId) : '-';

      return {
        userId: String(userId), // 确保 userId 是字符串类型
        city: normalizeRegionName(event),
        deviceType: device,
        browser: event.browser || 'Unknown',
        localTime,
        pageUrl: latestPage
      };
    });

    // 计算城市分布
    const cityMap = new Map<string, number>();
    userDetails.forEach(user => {
      const city = user.city || 'Unknown';
      cityMap.set(city, (cityMap.get(city) || 0) + 1);
    });
    const cityDistribution = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 计算设备分布
    const deviceMap = new Map<string, number>();
    userDetails.forEach(user => {
      const device = user.deviceType || 'Other';
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
    });
    const deviceDistribution = Array.from(deviceMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 计算页面路径分布（仅针对 active 类型）
    const pageMap = new Map<string, number>();
    if (type === 'active') {
      userDetails.forEach(user => {
        const page = user.pageUrl || '-';
        pageMap.set(page, (pageMap.get(page) || 0) + 1);
      });
    }
    const pageDistribution = Array.from(pageMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ 
      success: true, 
      data: {
        users: userDetails,
        total: userDetails.length,
        cityDistribution,
        deviceDistribution,
        pageDistribution: type === 'active' ? pageDistribution : undefined
      }
    }, { headers: corsHeaders });
  } catch (error) {
    log('error', 'Failed to fetch user details', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user details' },
      { status: 500, headers: corsHeaders }
    );
  }
}
