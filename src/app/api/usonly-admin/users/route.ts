import { NextRequest, NextResponse } from 'next/server';
import { verifyMonitorSessionToken } from '@/lib/monitorSession';
import { requestUsOnlyAdmin } from '@/lib/usonlyAdmin';

export async function GET(request: NextRequest) {
  try {
    const authorized = await verifyMonitorSessionToken(request.headers.get('x-monitor-session-token'));
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    const upstream = await requestUsOnlyAdmin({
      path: `/api/admin/users?q=${encodeURIComponent(query)}`,
    });
    const data = await upstream.json().catch(() => ({}));

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('Failed to search UsOnly users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search UsOnly users' },
      { status: 500 }
    );
  }
}
