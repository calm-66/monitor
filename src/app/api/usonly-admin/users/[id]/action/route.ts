import { NextRequest, NextResponse } from 'next/server';
import { verifyMonitorSessionToken } from '@/lib/monitorSession';
import { requestUsOnlyAdmin } from '@/lib/usonlyAdmin';
import prisma from '@/lib/prisma';

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
    const projectId = String(body.projectId || '');
    const actionPassword = String(body.actionPassword || '');
    const action = String(body.action || '');
    const actionPath = ACTION_PATHS[action];
    const { projectId: _projectId, actionPassword: _actionPassword, ...upstreamBody } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId' },
        { status: 400 }
      );
    }

    if (!actionPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const expectedActionPassword = process.env.USONLY_ADMIN_ACTION_PASSWORD || '';
    if (!expectedActionPassword) {
      return NextResponse.json(
        { success: false, error: 'UsOnly admin action password is not configured' },
        { status: 500 }
      );
    }

    if (actionPassword !== expectedActionPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid action password' },
        { status: 403 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        isActive: true,
      },
      select: {
        domain: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const upstream = await requestUsOnlyAdmin({
      baseUrl: project.domain,
      path: `/api/admin/users/${encodeURIComponent(id)}/${actionPath}`,
      method: 'POST',
      body: upstreamBody,
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
