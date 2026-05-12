import { NextRequest, NextResponse } from 'next/server';
import { verifyMonitorSessionToken } from '@/lib/monitorSession';
import { requestUsOnlyAdmin } from '@/lib/usonlyAdmin';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authorized = await verifyMonitorSessionToken(request.headers.get('x-monitor-session-token'));
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projectId = request.nextUrl.searchParams.get('projectId') || '';
    const query = request.nextUrl.searchParams.get('q') || '';

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400 }
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
