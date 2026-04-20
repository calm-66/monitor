/**
 * 支付事件列表端点
 * GET /api/payment/events
 * 
 * 返回支付事件列表，支持分页和筛选
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const eventType = searchParams.get('eventType');

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    if (eventType) {
      where.eventType = eventType;
    }

    // 获取事件列表
    const [events, total] = await Promise.all([
      prisma.paymentEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.paymentEvent.count({ where }),
    ]);

    // 格式化返回数据
    const formattedEvents = events.map(e => ({
      id: e.id,
      source: e.source,
      eventType: e.eventType,
      orderId: e.orderId,
      amount: Number(e.amount), // 直接使用（元）
      currency: e.currency,
      metadata: e.metadata,
      receivedAt: e.receivedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取支付事件列表失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}