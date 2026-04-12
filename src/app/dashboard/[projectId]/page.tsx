'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { StatsResponse, IpLimitStats, Project } from '@/types/monitor';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// 颜色配置
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// 获取当前月份的字符串（如 "April 2026"）
function getCurrentMonthStr(): string {
  const now = new Date();
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// 格式化日期为短格式（如 "04-10"）
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

// 获取 X 轴刻度间隔（根据数据量动态调整刻度显示策略）
function getXAxisTicks(data: Array<{ date: string }>): string[] {
  if (data.length === 0) return [];
  if (data.length === 1) return [data[0].date];
  
  // 数据量 <= 7 天：显示所有日期
  if (data.length <= 7) {
    return data.map(item => item.date);
  }
  
  // 数据量 > 7 天：显示第一天、最后一天和中间每隔几天的日期
  const firstDate = data[0].date;
  const lastDate = data[data.length - 1].date;
  
  // 计算中间刻度间隔（目标显示约 5-7 个刻度）
  const interval = Math.ceil(data.length / 6);
  
  const middleDates = data
    .filter((_, index) => index > 0 && index < data.length - 1 && index % interval === 0)
    .map(item => item.date);
  
  // 返回包含第一天、中间日期和最后一天的数组
  return [firstDate, ...middleDates, lastDate];
}

// 过滤出当前月份的数据
function filterCurrentMonth<T extends { date: string }>(data: T[]): T[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  return data.filter(item => {
    const date = new Date(item.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
}

// 自定义 Tooltip 组件
interface CustomTooltipProps {
  active?: boolean;
  payload?: unknown[];
  label?: string;
  color: string;
}

function CustomTooltip({ active, payload, label, color }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const item = payload[0] as { name?: string; value?: number | string };
    return (
      <div className="bg-white p-3 border border-gray-200 rounded shadow-md">
        <p className="font-semibold mb-1" style={{ color }}>{label}</p>
        <p style={{ color }}>{item.name} : {item.value}</p>
      </div>
    );
  }
  return null;
}

/**
 * 根据项目 domain 构建 UsOnly stats API URL
 * 处理用户可能输入的 https://、http://、/ 等前缀
 */
function buildStatsApiUrl(domain: string | null): string {
  if (!domain) return '';
  
  // 移除前后空格
  let cleanedDomain = domain.trim();
  
  // 移除协议前缀 (http://, https://)
  cleanedDomain = cleanedDomain.replace(/^https?:\/\//i, '');
  
  // 移除末尾的斜杠
  cleanedDomain = cleanedDomain.replace(/\/+$/, '');
  
  // 如果为空则返回空字符串
  if (!cleanedDomain) return '';
  
  // 构建完整的 API URL
  return `https://${cleanedDomain}/api/monitor/stats`;
}

export default function DashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);

  // 日期范围
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 日期范围结束
  const endDateStr = endDate;
  const loadProjectInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success && data.data.project) {
        const project = data.data.project;
        setProjectName(project.name);
        setApiKey(project.apiKey);
        setProjectInfo(project);
      }
    } catch (err) {
      console.error('Failed to load project info:', err);
    }
  }, [projectId]);

  // 获取外部用户统计 - 使用代理 API 避免 CORS 问题
  const loadExternalUserStats = useCallback(async () => {
    try {
      // 根据项目 domain 构建 statsApiUrl
      const statsApiUrl = buildStatsApiUrl(projectInfo?.domain || null);
      
      // 如果没有有效的 statsApiUrl，直接返回
      if (!statsApiUrl) return null;
      
      // 使用服务器端代理 API 调用 UsOnly，避免 CORS 限制
      const response = await fetch('/api/external-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statsApiUrl,
          apiKey: apiKey
        })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to load external user stats:', err);
      return null; // API 调用失败不影响其他功能
    }
  }, [projectInfo, apiKey]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/stats?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );

      if (response.status === 401) {
        setAuthError(true);
        setLoading(false);
        return null;
      }

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        setAuthError(false);
        setLoading(false);
        return data.data;
      } else {
        setError(data.error || 'Failed to load stats');
        setLoading(false);
        return null;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load stats');
      setLoading(false);
      return null;
    }
  }, [projectId, startDate, endDate, apiKey]);

  // 初始化
  useEffect(() => {
    loadProjectInfo();
  }, [loadProjectInfo]);

  // 当 API Key 加载完成后加载统计数据
  useEffect(() => {
    if (apiKey) {
      loadStats();
    }
  }, [apiKey, loadStats]);

  // 加载外部用户统计（初始加载 + 每 5 分钟自动刷新）
  useEffect(() => {
    const fetchExternalStats = async () => {
      // 只要有 projectInfo 和 apiKey 就尝试加载
      if (!projectInfo || !apiKey) return;
      
      const externalStats = await loadExternalUserStats();
      if (externalStats) {
        setStats(prev => {
          if (!prev) return null;
          return { ...prev, externalUserStats: externalStats };
        });
      }
    };
    
    fetchExternalStats();
    
    // 设置每 5 分钟（300000ms）自动刷新
    const intervalId = setInterval(fetchExternalStats, 300000);
    
    // 清理定时器
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [projectInfo, apiKey, loadExternalUserStats]);

  // 处理认证
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;

    // 使用 Basic Auth 重新加载页面
    const credentials = btoa(`admin:${password}`);
    sessionStorage.setItem('auth', credentials);
    window.location.reload();
  };

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 同时加载统计数据和外部用户统计
      const response = await fetch(
        `/api/stats?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );

      if (response.status === 401) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        // 加载外部用户统计并合并
        let externalStats = null;
        if (projectInfo && apiKey) {
          externalStats = await loadExternalUserStats();
        }
        
        const mergedStats = externalStats 
          ? { ...data.data, externalUserStats: externalStats }
          : data.data;
        
        setStats(mergedStats);
        setAuthError(false);
      } else {
        setError(data.error || 'Failed to load stats');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  // 如果没有通过认证，显示登录表单
  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Dashboard Authentication
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Enter dashboard password"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Login
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 text-center">
            The password is configured in the DASHBOARD_PASSWORD environment variable.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{projectName || 'Dashboard'}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {startDate} to {endDate}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to Projects
            </a>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* 加载中 */}
        {loading && !stats && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Loading stats...</p>
          </div>
        )}

        {/* 统计卡片和图表 */}
        {stats && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* 注册用户数（外部 API） */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Registered Users</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.externalUserStats?.totalUsers ?? '-'}
                </p>
                {stats.externalUserStats && (
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    {stats.externalUserStats.newUsersToday !== undefined && (
                      <p>Today: +{stats.externalUserStats.newUsersToday}</p>
                    )}
                    {stats.externalUserStats.newUsersThisWeek !== undefined && (
                      <p>This Week: +{stats.externalUserStats.newUsersThisWeek}</p>
                    )}
                    {stats.externalUserStats.newUsersThisMonth !== undefined && (
                      <p>This Month: +{stats.externalUserStats.newUsersThisMonth}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 当日 PV */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Page Views</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.todayPV ?? '-'}
                </p>
              </div>

              {/* 每日访问用户数（UV） */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Unique Visitors</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.uniqueVisitorsByDay?.length > 0 ? stats.uniqueVisitorsByDay[stats.uniqueVisitorsByDay.length - 1]?.count : '-'}
                </p>
              </div>

              {/* 每日登录用户数 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {(() => {
                    const dailyActiveUsers = stats.externalUserStats?.dailyActiveUsers;
                    if (dailyActiveUsers && dailyActiveUsers.length > 0) {
                      return dailyActiveUsers[dailyActiveUsers.length - 1].count;
                    }
                    return '-';
                  })()}
                </p>
              </div>
            </div>

            {/* 图表 - 每日访问用户数和每日登录用户数 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 每日访问用户数（PV）柱状图 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Page Views ({getCurrentMonthStr()})</h3>
              {stats.viewsByDay && stats.viewsByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filterCurrentMonth(stats.viewsByDay)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatShortDate}
                      ticks={getXAxisTicks(filterCurrentMonth(stats.viewsByDay))}
                      interval="preserveStartEnd"
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={(props) => <CustomTooltip {...props} color="#3B82F6" />} />
                    <Legend />
                    <Bar dataKey="count" fill="#3B82F6" name="Page Views" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  No data available for this period
                </div>
              )}
            </div>

            {/* 每日独立访客数（UV）柱状图 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Unique Visitors ({getCurrentMonthStr()})</h3>
              {stats.uniqueVisitorsByDay && stats.uniqueVisitorsByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filterCurrentMonth(stats.uniqueVisitorsByDay)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatShortDate}
                      ticks={getXAxisTicks(filterCurrentMonth(stats.uniqueVisitorsByDay))}
                      interval="preserveStartEnd"
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={(props) => <CustomTooltip {...props} color="#10B981" />} />
                    <Legend />
                    <Bar dataKey="count" fill="#10B981" name="Unique Visitors" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  No data available for this period
                </div>
              )}
            </div>

            {/* 每日登录用户数柱状图 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Active Users ({getCurrentMonthStr()})</h3>
              {stats.externalUserStats?.dailyActiveUsers && stats.externalUserStats.dailyActiveUsers.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filterCurrentMonth(stats.externalUserStats.dailyActiveUsers)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatShortDate}
                      ticks={getXAxisTicks(filterCurrentMonth(stats.externalUserStats.dailyActiveUsers))}
                      interval="preserveStartEnd"
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={(props) => <CustomTooltip {...props} color="#8B5CF6" />} />
                    <Legend />
                    <Bar dataKey="count" fill="#8B5CF6" name="Active Users" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  No data available for this period
                </div>
              )}
            </div>

            {/* IP 地址解析饼状图 - 显示已登录用户的地区分布 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Unique Visitors Locations (Top 10 Regions, {getCurrentMonthStr()})</h3>
              {stats.activeUsersByRegion && stats.activeUsersByRegion.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.activeUsersByRegion}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#F59E0B"
                      dataKey="count"
                    >
                      {stats.activeUsersByRegion.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#F59E0B" />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  No data available for this period
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}