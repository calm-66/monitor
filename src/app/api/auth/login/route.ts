import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * 生成加密安全的随机 token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 获取 session token 的过期时间
 * @param days - 过期天数，默认 30 天
 */
function getExpiryDate(days: number = 30): Date {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * POST /api/auth/login
 * 验证密码并创建 session token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // 验证必填字段
    if (!password) {
      return NextResponse.json(
        { success: false, error: '密码为必填项' },
        { status: 400 }
      );
    }

    // 验证密码（与环境变量比较）
    const correctPassword = process.env.DASHBOARD_PASSWORD;
    
    // 如果没有配置密码，拒绝登录
    if (!correctPassword || correctPassword === 'your_secure_password_here') {
      console.warn('警告：DASHBOARD_PASSWORD 未配置');
      return NextResponse.json(
        { success: false, error: '服务器未配置密码，请联系管理员' },
        { status: 500 }
      );
    }

    // 验证密码
    if (password !== correctPassword) {
      return NextResponse.json(
        { success: false, error: '密码错误' },
        { status: 401 }
      );
    }

    // 生成 session token
    const token = generateSessionToken();
    const expiresAt = getExpiryDate(30); // 30 天过期

    // 保存到数据库
    await prisma.sessionToken.create({
      data: {
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}