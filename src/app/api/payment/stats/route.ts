/**
 * 支付统计端点
 * GET /api/payment/stats
 * 
 * 返回支付相关统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 获取所有支付事件
    const allEvents = await prisma.paymentEvent.findMany({
      where: {
        eventType: 'payment.completed',
      },
      select: {
        amount: true,
        receivedAt: true,
      },
    });

    // 计算统计数据
    const totalAmount = allEvents.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCount = allEvents.length;

    // 今日统计
    const todayEvents = allEvents.filter(e => new Date(e.receivedAt) >= todayStart);
    const todayAmount = todayEvents.reduce((sum, e) => sum + Number(e.amount), 0);

    // 本周统计
    const weekEvents = allEvents.filter(e => new Date(e.receivedAt) >= weekStart);
    const weekAmount = weekEvents.reduce((sum, e) => sum + Number(e.amount), 0);

    // 本月统计
    const monthEvents = allEvents.filter(e => new Date(e.receivedAt) >= monthStart);
    const monthAmount = monthEvents.reduce((sum, e) => sum + Number(e.amount), 0);

    // 平均客单价
    const avgOrderValue = totalCount > 0 ? totalAmount / totalCount : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalAmount: totalAmount / 100, // 转换回元
        totalCount,
        todayAmount: todayAmount / 100,
        todayCount: todayEvents.length,
        weekAmount: weekAmount / 100,
        weekCount: weekEvents.length,
        monthAmount: monthAmount / 100,
        monthCount: monthEvents.length,
        avgOrderValue: avgOrderValue / 100,
      },
    });
  } catch (error) {
    console.error('获取支付统计失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}