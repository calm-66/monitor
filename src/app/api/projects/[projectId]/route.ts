import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { log } from '@/lib/utils';

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

/**
 * GET /api/projects/[projectId]
 * 获取单个项目详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    
    // 验证项目 ID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID format' },
        { status: 400 }
      );
    }
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        apiKey: true,
        domain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { events: true }
        }
      }
    });
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: { project } });
  } catch (error) {
    log('error', 'Failed to fetch project', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]
 * 删除项目（级联删除关联事件）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    
    // 验证项目 ID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID format' },
        { status: 400 }
      );
    }
    
    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // 删除项目（级联删除关联事件和 IP 限制追踪记录）
    await prisma.project.delete({
      where: { id: projectId }
    });
    
    log('info', `Project deleted: ${project.name}`, { projectId });
    
    return NextResponse.json({ success: true, data: { id: projectId } });
  } catch (error) {
    log('error', 'Failed to delete project', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}