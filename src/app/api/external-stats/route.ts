import { NextRequest, NextResponse } from 'next/server';

/**
 * 外部用户统计代理 API
 * 
 * 由于 CORS 限制，前端不能直接调用 UsOnly 的 API。
 * 此端点作为服务器端代理，调用 UsOnly 的 /api/monitor/stats 接口。
 * 
 * 请求参数:
 * - statsApiUrl: UsOnly 的 stats API URL
 * - apiKey: 可选的 API Key
 * 
 * 响应格式:
 * {
 *   success: boolean,
 *   data?: { ... },
 *   error?: string
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { statsApiUrl, apiKey } = body;

    // 验证必填参数
    if (!statsApiUrl || typeof statsApiUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'statsApiUrl is required' },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    try {
      new URL(statsApiUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid statsApiUrl format' },
        { status: 400 }
      );
    }

    // 构建请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    // 调用 UsOnly 的 API（服务器对服务器，无 CORS 限制）
    const response = await fetch(statsApiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: `External API returned status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in external-stats proxy:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}