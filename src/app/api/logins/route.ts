import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDateRange, log, formatAsBeijingDate } from '@/lib/utils';

// 简单的 CORS 头（允许所有来源）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

// 处理 OPTIONS 预检请求
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * GET /api/logins
 * 获取登录统计数据（基于 login 事件）
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
    
    // 获取登录事件总数（eventName = 'login'）
    const totalLoginsResult = await prisma.event.aggregate({
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });
    
    // 获取独立登录用户数（按 userId 去重）
    const uniqueLoginUsersResult = await prisma.event.findMany({
      where: {
        projectId,
        eventName: 'login',
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
    
    // 按日期分组统计登录次数（使用北京时间）
    const loginsByDayResult = await prisma.event.groupBy({
      by: ['createdAt'],
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // 转换为北京时间的登录统计
    const loginsByDayMap = new Map<string, number>();
    loginsByDayResult.forEach((item: { createdAt: Date; _count: { id: number } }) => {
      const beijingDate = formatAsBeijingDate(item.createdAt);
      loginsByDayMap.set(beijingDate, (loginsByDayMap.get(beijingDate) || 0) + item._count.id);
    });
    
    const loginsByDay = Array.from(loginsByDayMap.entries()).map(([date, count]) => ({
      date,
      count
    }));
    
    // 按日期分组统计独立登录用户数（使用北京时间）
    const eventsWithUserId = await prisma.event.findMany({
      where: {
        projectId,
        eventName: 'login',
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
    
    const uniqueUsersByDayMap = new Map<string, Set<string>>();
    eventsWithUserId.forEach((event) => {
      const beijingDate = formatAsBeijingDate(event.createdAt);
      if (!uniqueUsersByDayMap.has(beijingDate)) {
        uniqueUsersByDayMap.set(beijingDate, new Set());
      }
      uniqueUsersByDayMap.get(beijingDate)!.add(event.userId!);
    });
    
    const uniqueUsersByDay = Array.from(uniqueUsersByDayMap.entries()).map(([date, userIdSet]) => ({
      date,
      count: userIdSet.size
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    // 按城市分组统计登录次数（前 10 个城市）
    const loginsByCityResult = await prisma.event.groupBy({
      by: ['city'],
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        },
        city: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });
    
    const loginsByCity = loginsByCityResult.map((item: { city: string | null; _count: { id: number } }) => ({
      city: item.city || 'Unknown',
      count: item._count.id
    }));
    
    // 按设备类型分组统计（desktop/mobile/tablet）
    const loginsByDeviceResult = await prisma.event.groupBy({
      by: ['deviceType'],
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        },
        deviceType: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    const loginsByDevice = loginsByDeviceResult.map((item: { deviceType: string | null; _count: { id: number } }) => ({
      deviceType: item.deviceType || 'Unknown',
      count: item._count.id
    }));
    
    // 按浏览器分组统计
    const loginsByBrowserResult = await prisma.event.groupBy({
      by: ['browser'],
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        },
        browser: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });
    
    const loginsByBrowser = loginsByBrowserResult.map((item: { browser: string | null; _count: { id: number } }) => ({
      browser: item.browser || 'Unknown',
      count: item._count.id
    }));
    
    // 按操作系统分组统计
    const loginsByOSResult = await prisma.event.groupBy({
      by: ['os'],
      _count: {
        id: true
      },
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        },
        os: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });
    
    const loginsByOS = loginsByOSResult.map((item: { os: string | null; _count: { id: number } }) => ({
      os: item.os || 'Unknown',
      count: item._count.id
    }));
    
    // 获取最近的登录记录（用于列表展示）
    const recentLoginsResult = await prisma.event.findMany({
      where: {
        projectId,
        eventName: 'login',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        userId: true,
        city: true,
        country: true,
        deviceType: true,
        browser: true,
        os: true,
        createdAt: true,
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 最近 50 条登录记录
    });
    
    const recentLogins = recentLoginsResult.map((item: any) => ({
      userId: item.userId,
      city: item.city,
      country: item.country,
      deviceType: item.deviceType,
      browser: item.browser,
      os: item.os,
      createdAt: item.createdAt,
      username: item.metadata?.username,
      usOnlyUserId: item.metadata?.usOnlyUserId
    }));
    
    // 构建响应数据
    const stats = {
      totalLogins: totalLoginsResult._count.id,
      uniqueLoginUsers: uniqueLoginUsersResult.length,
      loginsByDay,
      uniqueUsersByDay,
      loginsByCity,
      loginsByDevice,
      loginsByBrowser,
      loginsByOS,
      recentLogins
    };
    
    return NextResponse.json({ success: true, data: stats }, { headers: corsHeaders });
  } catch (error) {
    log('error', 'Failed to fetch login stats', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch login stats' },
      { status: 500, headers: corsHeaders }
    );
  }
}