/**
 * 接收支付事件上报端点
 * POST /api/payment/event
 * 
 * 用于接收 UsOnly 项目推送的支付事件
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 从环境变量获取 API Key
const EXPECTED_API_KEY = process.env.USONLY_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '缺少授权信息' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // 移除 "Bearer " 前缀
    if (!EXPECTED_API_KEY || apiKey !== EXPECTED_API_KEY) {
      return NextResponse.json(
        { error: '授权失败：API Key 无效' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const {
      source,
      eventType,
      orderId,
      amount,
      currency,
      metadata,
      timestamp,
    } = body;

    // 验证必填字段
    if (!source || !eventType || !orderId || amount === undefined) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 存储事件到数据库
    const event = await prisma.paymentEvent.create({
      data: {
        source,
        eventType,
        orderId,
        amount: BigInt(Math.round(amount * 100)), // 转换为分存储
        currency: currency || 'CNY',
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        receivedAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.id,
    });
  } catch (error) {
    console.error('接收支付事件失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}