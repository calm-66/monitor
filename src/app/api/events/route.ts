import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveGeoIP, parseUserAgent } from '@/lib/geoip';
import { getClientIP, formatAsBeijingDate, log } from '@/lib/utils';
import { EventPayload } from '@/types/monitor';

/**
 * 获取北京时间（UTC+8）
 * PostgreSQL 存储 timestamp 时会自动转换为 UTC，所以我们在写入时传入北京时间对象
 */
function getBeijingNow(): Date {
  // 获取当前 UTC 时间
  const now = new Date();
  // 转换为北京时间（UTC+8）
  // 方法：获取 UTC 时间戳，加上 8 小时的毫秒数
  const beijingTimestamp = now.getTime() + (8 * 60 * 60 * 1000);
  return new Date(beijingTimestamp);
}

// CORS 配置
function getCorsHeaders(origin?: string) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || ['*'];
  const allowedOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))
    ? origin || '*'
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
    'Access-Control-Max-Age': '86400',
  };
}

// 处理 OPTIONS 预检请求
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * POST /api/events
 * 接收事件上报（支持批量）
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);
  
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
        { status: 401, headers: corsHeaders }
      );
    }
    
    if (!projectId) {
      console.log('[API /events] Missing Project ID');
      return NextResponse.json(
        { success: false, error: 'Missing X-Project-ID header' },
        { status: 401, headers: corsHeaders }
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
        { status: 401, headers: corsHeaders }
      );
    }
    
    console.log('[API /events] Project validated:', project.id);
    
    // 解析请求体
    const body = await request.json();
    const events: EventPayload[] = Array.isArray(body) ? body : [body];
    
    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No events provided' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // 限制批量大小
    const MAX_BATCH_SIZE = 100;
    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
        { status: 400, headers: corsHeaders }
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
    
    // 获取北京时间（用于 createdAt）
    const beijingNow = getBeijingNow();
    
    // 准备批量插入的数据
    const eventsToCreate = events.map((event: EventPayload) => ({
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
      createdAt: beijingNow,  // 使用北京时间
    }));
    
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
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    log('error', 'Failed to process events', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process events' },
      { status: 500, headers: corsHeaders }
    );
  }
}