import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { HealthResponse } from '@/types/monitor';
import { log } from '@/lib/utils';

/**
 * GET /api/health
 * 健康检查端点
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    // 测试数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    const health: HealthResponse = {
      status: 'ok',
      database: 'connected',
      responseTime,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({ success: true, data: health });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    log('error', 'Health check failed', error);
    
    const health: HealthResponse = {
      status: 'error',
      database: 'disconnected',
      responseTime,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(
      { success: false, data: health },
      { status: 503 }
    );
  }
}