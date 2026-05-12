import { NextRequest, NextResponse } from 'next/server';
import { verifyMonitorSessionToken } from '@/lib/monitorSession';
import { requestUsOnlyAdmin } from '@/lib/usonlyAdmin';

const ACTION_PATHS: Record<string, string> = {
  disable: 'disable',
  enable: 'enable',
  forceDelete: 'force-delete',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorized = await verifyMonitorSessionToken(request.headers.get('x-monitor-session-token'));
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const actionPath = ACTION_PATHS[action];

    if (!actionPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const upstream = await requestUsOnlyAdmin({
      path: `/api/admin/users/${encodeURIComponent(id)}/${actionPath}`,
      method: 'POST',
      body,
    });
    const data = await upstream.json().catch(() => ({}));

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('Failed to run UsOnly admin action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run UsOnly admin action' },
      { status: 500 }
    );
  }
}
