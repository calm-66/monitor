import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { log } from '@/lib/utils';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function buildPostsUrl(domain: string | null, date: string): string | null {
  if (!domain) return null;
  const cleanedDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!cleanedDomain) return null;
  return `https://${cleanedDomain}/api/monitor/posts?date=${encodeURIComponent(date)}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const date = searchParams.get('date')?.trim();

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Missing date parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing X-API-Key header' },
        { status: 401, headers: corsHeaders }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        apiKey,
        isActive: true,
      },
      select: {
        domain: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or Project ID' },
        { status: 401, headers: corsHeaders }
      );
    }

    const url = buildPostsUrl(project.domain, date);
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Project domain is not configured' },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (error) {
    log('error', 'Failed to fetch posts', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500, headers: corsHeaders }
    );
  }
}
