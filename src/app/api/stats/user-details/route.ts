import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log } from '@/lib/utils';

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
 * 时区偏移映射（小时）
 * 根据城市/国家推断时区偏移
 */
function getTimezoneOffset(city: string | null, country: string | null): number {
  if (!city && !country) return 0; // 默认 UTC

  const cityLower = city?.toLowerCase() || '';
  const countryLower = country?.toLowerCase() || '';

  // 美国城市
  const usEastCities = ['new york', 'ashburn', 'manassas', 'newark', 'boston', 'philadelphia', 'washington'];
  const usWestCities = ['los angeles', 'san francisco', 'seattle', 'portland', 'san diego'];
  const usCentralCities = ['chicago', 'dallas', 'houston', 'minneapolis'];
  
  if (usEastCities.some(c => cityLower.includes(c))) return -5; // 美国东部 (EST)
  if (usWestCities.some(c => cityLower.includes(c))) return -8; // 美国西部 (PST)
  if (usCentralCities.some(c => cityLower.includes(c))) return -6; // 美国中部 (CST)
  if (countryLower === 'united states' || countryLower === 'usa') return -5; // 默认美国东部

  // 中国
  if (countryLower === 'china' || cityLower.includes('shanghai') || cityLower.includes('beijing') || cityLower.includes('shenzhen')) return 8;

  // 日本
  if (countryLower === 'japan' || cityLower.includes('tokyo') || cityLower.includes('shinagawa')) return 9;

  // 台湾
  if (countryLower === 'taiwan' || cityLower.includes('taipei')) return 8;

  // 韩国
  if (countryLower === 'south korea' || cityLower.includes('seoul')) return 9;

  // 新加坡
  if (countryLower === 'singapore') return 8;

  // 英国
  if (countryLower === 'united kingdom' || countryLower === 'uk' || cityLower.includes('london')) return 0;

  // 欧洲 (默认巴黎时区)
  const europeanCountries = ['germany', 'france', 'italy', 'spain', 'netherlands'];
  if (europeanCountries.some(c => countryLower.includes(c))) return 1;

  // 澳大利亚东部
  if (countryLower === 'australia' || cityLower.includes('sydney') || cityLower.includes('melbourne')) return 10;

  // 默认返回 0 (UTC)
  return 0;
}

/**
 * 将 UTC 时间转换为当地时间
 */
function convertToLocalTime(utcDate: Date, offset: number): string {
  const localTime = new Date(utcDate.getTime() + offset * 60 * 60 * 1000);
  const year = localTime.getUTCFullYear();
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localTime.getUTCDate()).padStart(2, '0');
  const hours = String(localTime.getUTCHours()).padStart(2, '0');
  const minutes = String(localTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(localTime.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
      // 如果指定了日期，使用该日期的开始和结束
      start = new Date(`${date}T00:00:00Z`);
      end = new Date(`${date}T23:59:59Z`);
    } else {
      // 否则使用 startDate 和 endDate
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
          }
        };
        
        events = await prisma.event.findMany({
          where: allEventsWhereCondition,
          select: {
            userId: true,
            city: true,
            country: true,
            deviceType: true,
            os: true,
            browser: true,
            createdAt: true,
            pageUrl: true
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
        userId: { not: null }
      };
      
      events = await prisma.event.findMany({
        where: whereCondition,
        select: {
          userId: true,
          city: true,
          country: true,
          deviceType: true,
          os: true,
          browser: true,
          createdAt: true,
          pageUrl: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 500
      });
    }

    // 按 userId 分组，获取每个用户的最近访问页面和最新事件信息
    const userPageVisits = new Map<string, Map<string, number>>();
    const userEvents = new Map<string, typeof events[0]>(); // 保留每个用户的最新事件（用于其他字段）
    
    events.forEach(event => {
      const userId = event.userId!;
      
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
        .filter(e => e.userId === userId)
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
      const localTime = convertToLocalTime(event.createdAt, offset);
      const device = categorizeDevice(event.deviceType, event.os);
      
      // 获取该用户最近访问的页面
      const pageVisits = userPageVisits.get(userId);
      const latestPage = pageVisits ? getLatestPage(pageVisits, userId) : '-';

      return {
        userId: userId,
        city: event.city || event.country || 'Unknown',
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