import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log } from '@/lib/utils';

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
 * 格式化设备显示
 */
function formatDevice(deviceType: string | null, os: string | null): { icon: string; text: string } {
  const type = deviceType?.toLowerCase() || '';
  const osLower = os?.toLowerCase() || '';

  let icon = '🖥️';
  let text = 'Desktop';

  if (type === 'mobile') {
    icon = '📱';
    if (osLower.includes('iphone') || osLower.includes('ios')) {
      text = 'Mobile (iPhone)';
    } else if (osLower.includes('android')) {
      text = 'Mobile (Android)';
    } else {
      text = 'Mobile';
    }
  } else if (type === 'tablet') {
    icon = '📱';
    text = 'Tablet';
  }

  return { icon, text };
}

/**
 * GET /api/stats/user-details
 * 获取用户详细信息列表
 * 查询参数：projectId, startDate, endDate, type (uv/active)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const type = searchParams.get('type') || 'uv'; // 'uv' 或 'active'

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

    // 查询条件：根据类型区分
    // UV: 所有有 userId 的事件（去重）
    // Active: 所有有 userId 的事件（去重），额外包含 pageUrl
    const whereCondition = {
      projectId,
      createdAt: {
        gte: start,
        lte: end
      },
      userId: { not: null }
    };

    // 获取所有带 userId 的事件记录
    const events = await prisma.event.findMany({
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
      take: 100 // 限制最多 100 条记录
    });

    // 按 userId 去重，保留每个用户的第一条记录
    const userMap = new Map<string, typeof events[0]>();
    events.forEach(event => {
      if (!userMap.has(event.userId!)) {
        userMap.set(event.userId!, event);
      }
    });

    // 转换为响应格式
    const userDetails = Array.from(userMap.values()).map(event => {
      const offset = getTimezoneOffset(event.city, event.country);
      const localTime = convertToLocalTime(event.createdAt, offset);
      const device = formatDevice(event.deviceType, event.os);

      return {
        userId: event.userId,
        city: event.city || event.country || 'Unknown',
        deviceIcon: device.icon,
        deviceText: device.text,
        browser: event.browser || 'Unknown',
        localTime,
        pageUrl: event.pageUrl
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        users: userDetails,
        total: userDetails.length
      }
    });
  } catch (error) {
    log('error', 'Failed to fetch user details', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}