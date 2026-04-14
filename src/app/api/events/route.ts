import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveGeoIP, parseUserAgent } from '@/lib/geoip';
import { getClientIP, formatAsBeijingDate, log } from '@/lib/utils';
import { EventPayload } from '@/types/monitor';

/**
 * POST /api/events
 * 接收事件上报（支持批量）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    const apiKey = request.headers.get('X-API-Key');
    const projectId = request.headers.get('X-Project-ID');
    
    console.log('[API /events] Request headers:', {
      'X-API-Key': apiKey ? '***' + apiKey.slice(-8) : 'missing',
      'X-Project-ID': projectId || 'missing',
      'Content-Type': request.headers.get('Content-Type'),
      'Origin': request.headers.get('Origin'),
    });
    
    if (!apiKey) {
      console.log('[API /events] Missing API Key');
      return NextResponse.json(
        { success: false, error: 'Missing X-API-Key header' },
        { status: 401 }
      );
    }
    
    if (!projectId) {
      console.log('[API /events] Missing Project ID');
      return NextResponse.json(
        { success: false, error: 'Missing Project ID' },
        { status: 401 }
      );
    }
    
    // 验证项目和 API Key
    console.log('[API /events] Looking up project:', projectId);
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        apiKey: apiKey,
        isActive: true
      }
    });
    
    if (!project) {
      console.log('[API /events] Project not found or inactive:', projectId);
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or Project ID' },
        { status: 401 }
      );
    }
    
    console.log('[API /events] Project validated:', project.id);
    
    // 解析请求体
    const body = await request.json();
    const events: EventPayload[] = Array.isArray(body) ? body : [body];
    
    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No events provided' },
        { status: 400 }
      );
    }
    
    // 限制批量大小
    const MAX_BATCH_SIZE = 100;
    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }
    
    // 获取客户端 IP
    const clientIP = getClientIP(request.headers);
    
    // 解析 IP 地理位置（带限流处理）
    const geoLocation = await resolveGeoIP(clientIP || '');
    const isRateLimited = geoLocation.status === 'fail' && geoLocation.message === 'rate limited';
    const isFailed = geoLocation.status === 'fail' && geoLocation.message !== 'rate limited';
    
    // 解析 User-Agent
    const firstEvent = events[0];
    const deviceInfo = parseUserAgent(firstEvent?.userAgent);
    
    // 准备批量插入的数据（使用前端发送的当地时间）
    const eventsToCreate = events.map((event: EventPayload) => {
      // 如果前端提供了 createdAt，使用它；否则使用服务器当前时间
      let createdAt: Date;
      if (event.createdAt) {
        // 前端发送的是 ISO 字符串（包含时区信息），直接解析
        createdAt = new Date(event.createdAt);
      } else {
        // 回退到服务器时间（UTC）
        createdAt = new Date();
      }
      
      return {
        projectId,
        eventType: event.eventType || 'pageview',
        eventName: event.eventName || null,
        sessionId: event.sessionId || null,
        pageUrl: event.pageUrl || null,
        pageTitle: event.pageTitle || null,
        referrer: event.referrer || null,
        userId: event.userId || null,
        ipAddress: clientIP || null,
        country: geoLocation.country || null,
        region: geoLocation.region || null,
        city: geoLocation.city || null,
        latitude: geoLocation.latitude || null,
        longitude: geoLocation.longitude || null,
        userAgent: event.userAgent || null,
        deviceType: deviceInfo.deviceType || null,
        browser: deviceInfo.browser || null,
        os: deviceInfo.os || null,
        screenWidth: event.screenWidth || null,
        screenHeight: event.screenHeight || null,
        metadata: event.metadata || undefined,
        createdAt,
      };
    });
    
    // 批量插入事件
    await prisma.event.createMany({
      data: eventsToCreate
    });
    
    // 更新 IP 限制追踪记录（使用北京时间）
    const today = formatAsBeijingDate(new Date());
    await prisma.ipLimitTracker.upsert({
      where: {
        projectId_date: {
          projectId,
          date: today
        }
      },
      update: {
        totalRequests: { increment: events.length },
        successfulResolves: isRateLimited || isFailed ? undefined : { increment: events.length },
        rateLimitedCount: isRateLimited ? { increment: events.length } : undefined,
        failedCount: isFailed ? { increment: events.length } : undefined,
      },
      create: {
        projectId,
        date: today,
        totalRequests: events.length,
        successfulResolves: isRateLimited || isFailed ? 0 : events.length,
        rateLimitedCount: isRateLimited ? events.length : 0,
        failedCount: isFailed ? events.length : 0,
      }
    });
    
    log('info', `Events received: ${events.length}`, { projectId, isRateLimited, isFailed });
    
    return NextResponse.json(
      { success: true, data: { received: events.length } },
      { status: 200 }
    );
  } catch (error) {
    log('error', 'Failed to process events', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process events' },
      { status: 500 }
    );
  }
}
