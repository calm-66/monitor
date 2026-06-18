import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

async function verifyProject(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');
  const projectId = request.headers.get('X-Project-ID');

  if (!apiKey || !projectId) {
    return { error: 'Missing X-API-Key or Project ID', status: 401 };
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      apiKey,
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (!project) {
    return { error: 'Invalid API Key or Project ID', status: 401 };
  }

  return { projectId };
}

export async function GET(request: NextRequest) {
  try {
    const verified = await verifyProject(request);
    if ('error' in verified) {
      return NextResponse.json(
        { success: false, error: verified.error },
        { status: verified.status, headers: corsHeaders }
      );
    }

    const readRows = await prisma.feedbackRead.findMany({
      where: {
        projectId: verified.projectId
      },
      select: {
        eventId: true
      }
    });

    const unreadCount = await prisma.event.count({
      where: {
        projectId: verified.projectId,
        eventType: 'feedback',
        id: {
          notIn: readRows.map(row => row.eventId)
        }
      }
    });

    return NextResponse.json(
      { success: true, data: { unreadCount } },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to fetch unread feedback count:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unread feedback count' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const verified = await verifyProject(request);
    if ('error' in verified) {
      return NextResponse.json(
        { success: false, error: verified.error },
        { status: verified.status, headers: corsHeaders }
      );
    }

    const body = await request.json().catch(() => ({}));
    const feedbackIds = Array.isArray(body.feedbackIds)
      ? body.feedbackIds.filter((id: unknown): id is string => typeof id === 'string')
      : typeof body.feedbackId === 'string'
        ? [body.feedbackId]
        : [];

    if (feedbackIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing feedbackId' },
        { status: 400, headers: corsHeaders }
      );
    }

    const feedbackEvents = await prisma.event.findMany({
      where: {
        projectId: verified.projectId,
        eventType: 'feedback',
        id: { in: feedbackIds }
      },
      select: {
        id: true
      }
    });

    await Promise.all(
      feedbackEvents.map(event =>
        prisma.feedbackRead.upsert({
          where: {
            eventId: event.id
          },
          create: {
            projectId: verified.projectId,
            eventId: event.id
          },
          update: {
            readAt: new Date()
          }
        })
      )
    );

    return NextResponse.json(
      { success: true, data: { readCount: feedbackEvents.length } },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to mark feedback as read:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark feedback as read' },
      { status: 500, headers: corsHeaders }
    );
  }
}
