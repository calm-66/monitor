import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Project-ID',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * GET /api/feedback
 * 获取反馈数据（从 Event 表中查询 eventType='feedback' 的记录）
 */
export async function GET(request: NextRequest) {
  try {
    // Verify API Key
    const apiKey = request.headers.get('X-API-Key');
    const projectId = request.headers.get('X-Project-ID');
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing X-API-Key header' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing Project ID' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    // Verify project and API Key
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        apiKey: apiKey,
        isActive: true
      }
    });
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or Project ID' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type'); // feedback type: suggestion/bug/other
    
    // Build query conditions
    const where: any = {
      projectId,
      eventType: 'feedback',
    };
    
    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }
    
    // Fetch feedback events
    const feedbacks = await prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    // Filter by feedback type if specified
    let filteredFeedbacks = feedbacks;
    if (type) {
      filteredFeedbacks = feedbacks.filter(f => 
        f.metadata && typeof f.metadata === 'object' && 
        (f.metadata as any).type === type
      );
    }
    
    // Transform data for frontend
    const formattedFeedbacks = filteredFeedbacks.map(f => ({
      id: f.id,
      type: (f.metadata as any)?.type || 'other',
      content: (f.metadata as any)?.content || '',
      userEmail: (f.metadata as any)?.userEmail || undefined,
      userId: f.userId,
      timestamp: (f.metadata as any)?.timestamp || f.createdAt,
      userAgent: (f.metadata as any)?.userAgent || f.userAgent,
      deviceType: f.deviceType,
      browser: f.browser,
      os: f.os,
      country: f.country,
      region: f.region,
      city: f.city,
      createdAt: f.createdAt,
    }));
    
    // Calculate statistics
    const stats = {
      total: formattedFeedbacks.length,
      suggestion: formattedFeedbacks.filter(f => f.type === 'suggestion').length,
      bug: formattedFeedbacks.filter(f => f.type === 'bug').length,
      other: formattedFeedbacks.filter(f => f.type === 'other').length,
    };
    
    return NextResponse.json(
      { 
        success: true, 
        data: {
          feedbacks: formattedFeedbacks,
          stats,
        } 
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to fetch feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback' },
      { status: 500, headers: corsHeaders }
    );
  }
}