import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateApiKey } from '@/lib/utils';
import { log } from '@/lib/utils';

/**
 * GET /api/projects
 * 获取所有项目列表
 */
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        apiKey: true,
        previewDomain: true,
        productionDomain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    return NextResponse.json({ success: true, data: { projects } });
  } catch (error) {
    log('error', 'Failed to fetch projects', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * 创建新的监控项目
 * 
 * body 参数：
 * - name: 项目名称
 * - description: 项目描述（可选）
 * - domain: 项目域名（用于区分数据来源，如 usonly-preview.vercel.app 或 usonly.com）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, domain } = body;
    
    // 验证必填字段
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }
    
    // 验证项目名称格式（仅允许字母、数字、连字符）
    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: 'Project name can only contain letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }
    
    // 检查项目名称是否已存在
    const existingProject = await prisma.project.findUnique({
      where: { name }
    });
    
    if (existingProject) {
      return NextResponse.json(
        { success: false, error: 'Project name already exists' },
        { status: 409 }
      );
    }
    
    // 生成 API Key
    const apiKey = generateApiKey();
    
    // 创建项目
    // 使用 previewDomain 存储传入的 domain（保持向后兼容）
    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        previewDomain: domain || null,
        apiKey,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        apiKey: true,
        previewDomain: true,
        productionDomain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    log('info', `Project created: ${name}`, { projectId: project.id });
    
    return NextResponse.json({ 
      success: true, 
      data: { project } 
    }, { status: 201 });
  } catch (error) {
    log('error', 'Failed to create project', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}