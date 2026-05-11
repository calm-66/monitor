import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatAsBeijingDate, formatAsBeijingDateTime, log, parseDateRange } from '@/lib/utils';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

function normalizeInputUserId(input: string) {
  const trimmed = input.trim();
  const withoutAccountPrefix = trimmed.startsWith('user_') ? trimmed.slice(5) : trimmed;
  const userIdCandidates = new Set<string>([trimmed]);

  if (trimmed && !trimmed.startsWith('user_')) {
    userIdCandidates.add(`user_${trimmed}`);
  }

  return {
    trimmed,
    withoutAccountPrefix,
    userIdCandidates: Array.from(userIdCandidates).filter(Boolean),
  };
}

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function addCount(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key && key.trim() ? key.trim() : 'Unknown';
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function mapToDistribution(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function parsePagePath(url: string | null): string {
  if (!url) return '-';
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

function normalizeLocation(event: { city: string | null; region: string | null; country: string | null }) {
  let location = event.city || event.region || event.country || 'Unknown';
  if (location.endsWith('市') && location.length > 2) {
    location = location.slice(0, -1);
  }
  return location;
}

function formatNullableDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatAsBeijingDateTime(date);
}

function normalizeContentStats(contentStats: any) {
  if (!contentStats) return null;
  return {
    ...contentStats,
    user: contentStats.user
      ? {
          ...contentStats.user,
          createdAt: formatNullableDate(contentStats.user.createdAt),
          lastLoginAt: formatNullableDate(contentStats.user.lastLoginAt),
          pairedAt: formatNullableDate(contentStats.user.pairedAt),
        }
      : contentStats.user,
    firstPostAt: formatNullableDate(contentStats.firstPostAt),
    lastPostAt: formatNullableDate(contentStats.lastPostAt),
    recentPosts: Array.isArray(contentStats.recentPosts)
      ? contentStats.recentPosts.map((post: any) => ({
          ...post,
          archivedAt: formatNullableDate(post.archivedAt),
          createdAt: formatNullableDate(post.createdAt),
        }))
      : [],
  };
}

function buildExternalUserUsageUrl(domain: string | null, userId: string): string | null {
  if (!domain) return null;
  const cleanedDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!cleanedDomain) return null;
  return `https://${cleanedDomain}/api/monitor/user-usage?userId=${encodeURIComponent(userId)}`;
}

async function fetchUsOnlyContentStats(domain: string | null, apiKey: string, userId: string) {
  const url = buildExternalUserUsageUrl(domain, userId);
  if (!url) {
    return {
      contentStats: null,
      contentStatsError: 'Project domain is not configured',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      return {
        contentStats: null,
        contentStatsError: `UsOnly API returned status ${response.status}`,
      };
    }

    const data = await response.json();
    if (!data.success) {
      return {
        contentStats: null,
        contentStatsError: data.error || 'Failed to load UsOnly content stats',
      };
    }

    return {
      contentStats: normalizeContentStats(data.data),
      contentStatsError: null,
    };
  } catch (error) {
    return {
      contentStats: null,
      contentStatsError: 'Failed to load UsOnly content stats',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const userIdInput = searchParams.get('userId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!userIdInput || !userIdInput.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
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
        isActive: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or Project ID' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { start, end } = parseDateRange(startDate, endDate);
    const { trimmed, withoutAccountPrefix, userIdCandidates } = normalizeInputUserId(userIdInput);

    const whereCondition: any = {
      projectId,
      createdAt: {
        gte: start,
        lte: end
      },
      OR: [
        { userId: { in: userIdCandidates } },
        { metadata: { path: ['usOnlyUserId'], equals: withoutAccountPrefix } },
        { metadata: { path: ['monitorUserId'], equals: trimmed } },
      ]
    };

    const [totalEvents, events] = await Promise.all([
      prisma.event.count({ where: whereCondition }),
      prisma.event.findMany({
        where: whereCondition,
        select: {
          id: true,
          eventType: true,
          eventName: true,
          pageUrl: true,
          userId: true,
          city: true,
          region: true,
          country: true,
          deviceType: true,
          browser: true,
          os: true,
          metadata: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1000
      })
    ]);

    const matchedUserIds = new Set<string>();
    const pageMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    const eventsByDayMap = new Map<string, number>();
    const activeDays = new Set<string>();
    let totalPageViews = 0;
    let totalLogins = 0;
    let usOnlyUserId: string | null = null;
    let monitorUserId: string | null = null;
    let username: string | null = null;

    events.forEach((event) => {
      if (event.userId) matchedUserIds.add(event.userId);

      const metadataUsOnlyUserId = getMetadataString(event.metadata, 'usOnlyUserId');
      const metadataMonitorUserId = getMetadataString(event.metadata, 'monitorUserId');
      const metadataUsername = getMetadataString(event.metadata, 'username');

      usOnlyUserId = usOnlyUserId || metadataUsOnlyUserId;
      monitorUserId = monitorUserId || metadataMonitorUserId;
      username = username || metadataUsername;

      if (event.eventType === 'pageview') {
        totalPageViews += 1;
      }

      if (event.eventName === 'login') {
        totalLogins += 1;
      }

      addCount(pageMap, parsePagePath(event.pageUrl));
      addCount(deviceMap, event.deviceType);
      addCount(browserMap, event.browser);
      addCount(locationMap, normalizeLocation(event));

      const date = formatAsBeijingDate(event.createdAt);
      eventsByDayMap.set(date, (eventsByDayMap.get(date) || 0) + 1);
      activeDays.add(date);
    });

    const lastSeenAt = events[0]?.createdAt || null;
    const firstSeenAt = events.length > 0 ? events[events.length - 1].createdAt : null;
    const resolvedUsOnlyUserId = usOnlyUserId || (trimmed.startsWith('user_') ? withoutAccountPrefix : null);
    const contentStatsResult = resolvedUsOnlyUserId
      ? await fetchUsOnlyContentStats(project.domain, apiKey, resolvedUsOnlyUserId)
      : {
          contentStats: null,
          contentStatsError: 'No UsOnly user ID was found for this query',
        };

    return NextResponse.json({
      success: true,
      data: {
        inputUserId: trimmed,
        matchedUserIds: Array.from(matchedUserIds),
        usOnlyUserId: resolvedUsOnlyUserId,
        monitorUserId,
        username,
        totalEvents,
        totalPageViews,
        totalLogins,
        activeDays: activeDays.size,
        firstSeenAt: firstSeenAt ? formatAsBeijingDateTime(firstSeenAt) : null,
        lastSeenAt: lastSeenAt ? formatAsBeijingDateTime(lastSeenAt) : null,
        topPages: mapToDistribution(pageMap),
        devices: mapToDistribution(deviceMap),
        browsers: mapToDistribution(browserMap),
        locations: mapToDistribution(locationMap),
        eventsByDay: Array.from(eventsByDayMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        recentEvents: events.slice(0, 50).map((event) => ({
          id: event.id,
          eventType: event.eventType,
          eventName: event.eventName,
          pageUrl: parsePagePath(event.pageUrl),
          city: event.city,
          region: event.region,
          country: event.country,
          deviceType: event.deviceType,
          browser: event.browser,
          os: event.os,
          createdAt: formatAsBeijingDateTime(event.createdAt),
        })),
        contentStats: contentStatsResult.contentStats,
        contentStatsError: contentStatsResult.contentStatsError,
      }
    }, { headers: corsHeaders });
  } catch (error) {
    log('error', 'Failed to fetch user usage', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user usage' },
      { status: 500, headers: corsHeaders }
    );
  }
}
