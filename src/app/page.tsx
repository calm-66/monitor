'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/monitor';

interface ProjectWithCount extends Project {
  _count?: { events: number };
}

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 检查 session 状态
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('monitor_session_token');
      if (!token) {
        setIsLoggedIn(false);
        setIsCheckingSession(false);
        return;
      }
      
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        
        if (res.ok) {
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('monitor_session_token');
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('检查 session 失败:', error);
        setIsLoggedIn(false);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  // 创建新项目
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined,
          domain: newProjectDomain.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Project "${data.data.project.name}" created! API Key: ${data.data.project.apiKey}`);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectDomain('');
        loadProjects();
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete project "${projectName}"? This will also delete all associated events.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Project "${projectName}" deleted`);
        loadProjects();
      } else {
        setError(data.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
    }
  };

  // 复制 API Key
  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setSuccessMessage('API Key copied to clipboard');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // 复制 Project ID
  const copyProjectId = (projectId: string) => {
    navigator.clipboard.writeText(projectId);
    setSuccessMessage('Project ID copied to clipboard');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // 检查 session 中，显示加载状态
  if (isCheckingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-500">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Monitor Platform</h1>
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-gray-500">已登录</span>
                <a
                  href="/login"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  管理登录
                </a>
              </>
            ) : (
              <a
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                管理员登录
              </a>
            )}
          </div>
        </div>

        {/* 创建项目表单 */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Project</h2>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="my-project"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                pattern="[a-zA-Z0-9-_]+"
                title="Only letters, numbers, hyphens, and underscores allowed"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                id="description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <input
                type="text"
                id="domain"
                value={newProjectDomain}
                onChange={(e) => setNewProjectDomain(e.target.value)}
                placeholder="usonly-preview.vercel.app or usonly.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Project
            </button>
          </form>
        </section>

        {/* 消息提示 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {/* 项目列表 */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Projects</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-gray-500">No projects yet. Create one above!</p>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                      {project.description && (
                        <p className="text-gray-500 text-sm mt-1">{project.description}</p>
                      )}
                      <div className="text-gray-500 text-sm mt-1">
                        {project.domain && (
                          <p>Domain: {project.domain}</p>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 min-w-[80px]">Project ID:</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-700 flex-1 truncate">
                            {project.id}
                          </code>
                          <button
                            onClick={() => copyProjectId(project.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm whitespace-nowrap"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 min-w-[80px]">API Key:</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-700 flex-1 truncate">
                            {project.apiKey.substring(0, 20)}...
                          </code>
                          <button
                            onClick={() => copyApiKey(project.apiKey)}
                            className="text-blue-600 hover:text-blue-800 text-sm whitespace-nowrap"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center space-x-4">
                        <a
                          href={`/dashboard/${project.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Dashboard →
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        project.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleDeleteProject(project.id, project.name)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}