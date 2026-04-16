import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 获取 session token 的过期时间（滑动过期）
 * @param days - 过期天数，默认 30 天
 */
function getExpiryDate(days: number = 30): Date {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * POST /api/auth/session
 * 验证 session token 是否有效
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: '缺少 token' },
        { status: 400 }
      );
    }

    // 查询 session
    const session = await prisma.sessionToken.findUnique({
      where: { token },
    });

    if (!session) {
      return NextResponse.json(
        { valid: false, error: 'Token 不存在' },
        { status: 404 }
      );
    }

    // 检查是否过期
    if (session.expiresAt < new Date()) {
      // 删除过期的 session
      await prisma.sessionToken.delete({
        where: { id: session.id },
      });
      return NextResponse.json(
        { valid: false, error: 'Token 已过期' },
        { status: 401 }
      );
    }

    // 滑动过期：更新 session 的过期时间
    const newExpiryDate = getExpiryDate(30);
    await prisma.sessionToken.update({
      where: { id: session.id },
      data: { expiresAt: newExpiryDate },
    });

    return NextResponse.json({
      valid: true,
      expiresAt: newExpiryDate.toISOString(),
    });
  } catch (error) {
    console.error('验证 session 失败:', error);
    return NextResponse.json(
      { valid: false, error: '验证失败' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/auth/session
 * 处理 CORS 预检请求
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}