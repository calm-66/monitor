'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { StatsResponse, IpLimitStats } from '@/types/monitor';
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

export default function DashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [apiKey, setApiKey] = useState('');

  // 日期范围
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 加载项目信息
  const loadProjectInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success && data.data.project) {
        setProjectName(data.data.project.name);
        setApiKey(data.data.project.apiKey);
      }
    } catch (err) {
      console.error('Failed to load project info:', err);
    }
  }, [projectId]);

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
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
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

  // 复制 API Key
  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    alert('API Key copied to clipboard');
  };

  // 刷新数据
  const handleRefresh = () => {
    loadStats();
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

        {/* API Key 显示 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">API Key:</span>
              <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-sm text-gray-700">
                {apiKey}
              </code>
            </div>
            <button
              onClick={copyApiKey}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Copy
            </button>
          </div>
        </div>

        {/* 日期范围选择 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
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

        {/* 统计卡片 */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* 总浏览数 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Views</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalViews}</p>
              </div>

              {/* 独立访客 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Unique Visitors</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.uniqueVisitors}</p>
              </div>

              {/* 平均每次访问页面数 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">Avg Views/Visitor</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.uniqueVisitors > 0
                    ? (stats.totalViews / stats.uniqueVisitors).toFixed(1)
                    : '0'}
                </p>
              </div>

              {/* IP 解析成功率 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-500">IP Resolve Rate</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.ipResolveStats.totalRequests > 0
                    ? ((1 - stats.ipResolveStats.rateLimitedRatio) * 100).toFixed(1)
                    : '100'}
                  %
                </p>
                {stats.ipResolveStats.rateLimitedCount > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    Rate limited: {stats.ipResolveStats.rateLimitedCount} requests
                  </p>
                )}
              </div>
            </div>

            {/* 图表行 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 按日趋势 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Views by Day</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.viewsByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Views"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 按国家分布 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Views by Country</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.viewsByCountry}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ country, percent }) =>
                        `${country || 'Unknown'} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.viewsByCountry.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 图表行 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 热门页面 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Pages</h3>
                <div className="space-y-3">
                  {stats.topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 truncate max-w-md">{page.page}</span>
                      </div>
                      <span className="text-gray-500 font-medium">{page.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* IP 解析统计 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">IP Resolution Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Requests</span>
                    <span className="font-medium text-gray-900">
                      {stats.ipResolveStats.totalRequests}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Successful Resolves</span>
                    <span className="font-medium text-green-600">
                      {stats.ipResolveStats.successfulResolves}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Rate Limited</span>
                    <span className="font-medium text-orange-600">
                      {stats.ipResolveStats.rateLimitedCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Failed</span>
                    <span className="font-medium text-red-600">
                      {stats.ipResolveStats.failedCount}
                    </span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Success Rate</span>
                      <span className="font-medium text-gray-900">
                        {stats.ipResolveStats.totalRequests > 0
                          ? ((stats.ipResolveStats.successfulResolves / stats.ipResolveStats.totalRequests) * 100).toFixed(1)
                          : '100'}
                        %
                      </span>
                    </div>
                  </div>
                </div>
                {stats.ipResolveStats.rateLimitedCount > 0 && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-sm text-orange-800">
                      <strong>Warning:</strong> Some IP resolution requests were rate limited by ip-api.com.
                      This is expected behavior with the free tier (45 requests/minute limit).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 按国家条形图 */}
            {stats.viewsByCountry.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Views by Country (Bar Chart)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.viewsByCountry}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3B82F6" name="Views" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* 集成代码示例 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Integration Code</h3>
          <p className="text-gray-600 mb-4">
            Add this script to your website to start tracking:
          </p>
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm text-gray-800">
{`<script src="/monitor.js"></script>
<script>
  Monitor.init({
    projectId: '${projectId}',
    apiKey: '${apiKey}',
    endpoint: '/api/events'
  });
</script>`}
          </pre>
        </div>
      </div>
    </main>
  );
}