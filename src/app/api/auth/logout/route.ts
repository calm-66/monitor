import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/logout
 * 删除 session token（用于登出）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '缺少 token' },
        { status: 400 }
      );
    }

    // 删除 session token
    await prisma.sessionToken.delete({
      where: { token },
    }).catch(() => {
      // 忽略错误，因为 token 可能已经不存在了
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('登出错误:', error);
    return NextResponse.json(
      { success: false, error: '登出失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/auth/logout
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