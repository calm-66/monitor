'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StatsResponse, IpLimitStats, Project, UserDetail, DistributionData, UserUsageSummary } from '@/types/monitor';
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

// 颜色配置（12 种颜色）
const COLORS = [
  '#3B82F6', // 蓝色
  '#10B981', // 绿色
  '#F59E0B', // 琥珀色
  '#EF4444', // 红色
  '#8B5CF6', // 紫色
  '#EC4899', // 粉色
  '#06B6D4', // 青色
  '#84CC16', // 青柠色
  '#F97316', // 橙色
  '#14B8A6', // 蓝绿色
  '#A855F7', // 紫罗兰色
  '#D946EF', // 紫红色
];

// 饼图颜色（PC/iPhone/Android）
const DEVICE_COLORS = {
  'PC': '#3B82F6',
  'iPhone': '#EC4899',
  'Android': '#10B981',
  'Mobile': '#F59E0B',
  'Tablet': '#8B5CF6',
  'Other': '#6B7280',
};

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

// 获取当天日期字符串（YYYY-MM-DD 格式）
function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当前月份的第一天（YYYY-MM-DD 格式）
function getCurrentMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

// 填充完整日期范围，缺失的日期填充 0 值（从当月 1 号到指定结束日期）
function fillMissingDates<T extends { date: string; count: number }>(
  data: T[],
  _startDate: string,
  endDate: string
): T[] {
  // 使用当月 1 号作为开始日期，而不是传入的 startDate（可能跨月）
  const start = new Date(getCurrentMonthStart());
  const end = new Date(endDate);
  const dataMap = new Map<string, number>();
  
  // 建立现有数据的映射
  data.forEach(item => {
    dataMap.set(item.date, item.count);
  });
  
  // 生成完整日期范围
  const result: T[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const count = dataMap.get(dateStr) || 0;
    result.push({ date: dateStr, count } as T);
    current.setDate(current.getDate() + 1);
  }
  
  return result;
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

// 饼图自定义 Tooltip
function PieTooltip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (active && payload && payload.length > 0) {
    const item = payload[0] as { name?: string; value?: number };
    return (
      <div className="bg-white p-3 border border-gray-200 rounded shadow-md">
        <p className="font-semibold">{item.name}</p>
        <p className="text-sm text-gray-600">Count: {item.value}</p>
      </div>
    );
  }
  return null;
}

// 饼图标签渲染函数 - 标签显示在饼图外部
interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
  index: number;
  payload: { value: number };
}

function renderPieLabel(props: PieLabelProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, index } = props;
  
  // 计算标签位置（在饼图外部，距离圆心更远）
  const labelRadius = outerRadius + 36;
  const x = cx + labelRadius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + labelRadius * Math.sin(-midAngle * (Math.PI / 180));
  
  // 获取当前扇区的颜色
  const sectorColor = COLORS[index % COLORS.length];
  
  return (
    <text
      x={x}
      y={y}
      fill={sectorColor}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="middle"
      fontWeight="bold"
      fontSize="11"
    >
      {`${name}: ${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function renderClickablePieLabel(props: PieLabelProps, onClick: (name: string) => void) {
  const { cx, cy, midAngle, outerRadius, percent, name, index } = props;
  const labelRadius = outerRadius + 36;
  const x = cx + labelRadius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + labelRadius * Math.sin(-midAngle * (Math.PI / 180));
  const sectorColor = COLORS[index % COLORS.length];

  return (
    <text
      x={x}
      y={y}
      fill={sectorColor}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="middle"
      fontWeight="bold"
      fontSize="11"
      onClick={() => onClick(name)}
      style={{ cursor: 'pointer' }}
    >
      {`${name}: ${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function RegionPieLegend({
  data,
  onRegionClick,
}: {
  data: DistributionData[];
  onRegionClick: (name: string) => void;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="w-full space-y-1 sm:w-52">
      {data.map((item, index) => {
        const color = COLORS[index % COLORS.length];
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;

        return (
          <button
            key={`${item.name}-${index}`}
            type="button"
            onClick={() => onRegionClick(item.name)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={`${item.name}: ${percent}% (${item.count})`}
          >
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium text-gray-700">
              {item.name}
            </span>
            <span className="flex-shrink-0 tabular-nums text-gray-500">
              {percent}%
            </span>
          </button>
        );
      })}
    </div>
  );
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
  const router = useRouter();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);

  // 日期范围
  const [startDate, setStartDate] = useState(() => {
    return getCurrentMonthStart();
  });
  const [endDate, setEndDate] = useState(() => getTodayStr());

  // 用户详细信息面板状态
  const [selectedCard, setSelectedCard] = useState<'uv' | 'active' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
  const [cityDistribution, setCityDistribution] = useState<DistributionData[]>([]);
  const [deviceDistribution, setDeviceDistribution] = useState<DistributionData[]>([]);
  const [pageDistribution, setPageDistribution] = useState<DistributionData[]>([]);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [usageUserId, setUsageUserId] = useState('');
  const [userUsage, setUserUsage] = useState<UserUsageSummary | null>(null);
  const [userUsageLoading, setUserUsageLoading] = useState(false);
  const [userUsageError, setUserUsageError] = useState('');

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

  const loadFeedbackCount = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await fetch('/api/feedback/read', {
        headers: {
          'X-API-Key': apiKey,
          'X-Project-ID': projectId,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.success) {
        setFeedbackCount(data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load feedback count:', err);
    }
  }, [projectId, apiKey]);

  // 加载用户详细信息
  const loadUserDetails = useCallback(async (type: 'uv' | 'active', date?: string, region?: string) => {
    setUserDetailsLoading(true);
    try {
      let url = `/api/stats/user-details?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}&type=${type}`;
      if (date) {
        url += `&date=${date}`;
      }
      if (region) {
        url += `&region=${encodeURIComponent(region)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserDetails(data.data.users);
          setCityDistribution(data.data.cityDistribution || []);
          setDeviceDistribution(data.data.deviceDistribution || []);
          setPageDistribution(data.data.pageDistribution || []);
        }
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setUserDetailsLoading(false);
    }
  }, [projectId, startDate, endDate, apiKey]);

  // 处理卡片点击 - 显示当天数据
  const handleCardClick = useCallback((type: 'uv' | 'active') => {
    const today = getTodayStr();
    setSelectedCard(type);
    setSelectedDate(today);
    setSelectedRegion(null);
    loadUserDetails(type, today);
  }, [loadUserDetails]);

  // 处理柱状图点击
  const handleBarClick = useCallback((type: 'uv' | 'active', date: string) => {
    setSelectedCard(type);
    setSelectedDate(date);
    setSelectedRegion(null);
    loadUserDetails(type, date);
  }, [loadUserDetails]);

  const handleRegionClick = useCallback((region: string) => {
    setSelectedCard('uv');
    setSelectedDate(null);
    setSelectedRegion(region);
    loadUserDetails('uv', undefined, region);
  }, [loadUserDetails]);

  // 关闭详细信息面板
  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
    setSelectedDate(null);
    setSelectedRegion(null);
    setUserDetails([]);
    setCityDistribution([]);
    setDeviceDistribution([]);
    setPageDistribution([]);
    setCopiedUserId(null);
  }, []);

  // 复制 User ID 到剪贴板
  const handleCopyUserId = useCallback(async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      // 2 秒后恢复显示
      setTimeout(() => setCopiedUserId(null), 2000);
    } catch (err) {
      console.error('Failed to copy user ID:', err);
    }
  }, []);

  const handleSearchUserUsage = useCallback(async () => {
    const trimmedUserId = usageUserId.trim();
    if (!trimmedUserId) {
      setUserUsageError('Please enter a user ID');
      setUserUsage(null);
      return;
    }

    setUserUsageLoading(true);
    setUserUsageError('');

    try {
      const response = await fetch(
        `/api/stats/user-usage?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}&userId=${encodeURIComponent(trimmedUserId)}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setUserUsage(null);
        setUserUsageError(data.error || 'Failed to load user usage');
        return;
      }

      setUserUsage(data.data);
    } catch (err) {
      console.error('Failed to load user usage:', err);
      setUserUsage(null);
      setUserUsageError('Failed to load user usage');
    } finally {
      setUserUsageLoading(false);
    }
  }, [apiKey, endDate, projectId, startDate, usageUserId]);

  // 加载项目信息
  useEffect(() => {
    loadProjectInfo();
  }, [router, loadProjectInfo]);

  // 当 API Key 加载完成后加载统计数据
  useEffect(() => {
    if (apiKey) {
      loadStats();
      loadFeedbackCount();
    }
  }, [apiKey, loadStats, loadFeedbackCount]);

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

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    loadFeedbackCount();
    
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

  // 获取面板标题
  const getPanelTitle = () => {
    const baseTitle = selectedCard === 'uv' ? 'Unique Visitors' : 'Active Users';
    if (selectedRegion) return `${baseTitle} - ${selectedRegion} (${getCurrentMonthStr()})`;
    if (!selectedDate) return baseTitle;
    
    const today = getTodayStr();
    if (selectedDate === today) {
      return `${baseTitle} - Today (${selectedDate})`;
    }
    return `${baseTitle} - ${selectedDate}`;
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-gray-50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="w-full">
        {/* 主内容区域 */}
        <div className="min-w-0">
          <div className="mx-auto w-full max-w-6xl">
            {/* 头部 */}
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">{projectName || 'Dashboard'}</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {getCurrentMonthStr()}
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                <a
                  href={`/dashboard/${projectId}/feedback`}
                  className="relative flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 sm:px-4"
                >
                  <span>💬</span>
                  <span>Feedback</span>
                  {feedbackCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white ring-2 ring-white">
                      {feedbackCount > 99 ? '99+' : feedbackCount}
                    </span>
                  )}
                </a>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:px-4"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
                <a
                  href="/"
                  className="col-span-2 rounded-md bg-gray-200 px-3 py-2 text-center text-sm text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:col-span-1 sm:px-4"
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
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:mb-8 xl:grid-cols-4">
                  {/* 注册用户数（外部 API） */}
                  <div className="rounded-lg bg-white p-5 shadow-md sm:p-6">
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
                  <div className="rounded-lg bg-white p-5 shadow-md sm:p-6">
                    <h3 className="text-sm font-medium text-gray-500">Page Views</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.todayPV ?? '-'}
                    </p>
                  </div>

                  {/* 每日访问用户数（UV） - 可点击 */}
                  <div 
                    className="cursor-pointer rounded-lg border-2 border-transparent bg-white p-5 shadow-md transition-shadow duration-200 hover:border-green-500 hover:shadow-lg sm:p-6"
                    onClick={() => handleCardClick('uv')}
                  >
                    <h3 className="text-sm font-medium text-gray-500">Unique Visitors</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {(() => {
                        const todayStr = getTodayStr();
                        const todayData = stats.uniqueVisitorsByDay?.find(item => item.date === todayStr);
                        return todayData?.count ?? 0;
                      })()}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Click for details</p>
                  </div>

                  {/* 每日登录用户数 - 可点击 */}
                  <div 
                    className="cursor-pointer rounded-lg border-2 border-transparent bg-white p-5 shadow-md transition-shadow duration-200 hover:border-purple-500 hover:shadow-lg sm:p-6"
                    onClick={() => handleCardClick('active')}
                  >
                    <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {(() => {
                        const dailyActiveUsers = stats.dailyActiveUsers;
                        if (!dailyActiveUsers || dailyActiveUsers.length === 0) return '0';
                        
                        // 查找当天的数据
                        const todayStr = getTodayStr();
                        const todayData = dailyActiveUsers.find(item => item.date === todayStr);
                        return todayData?.count ?? 0;
                      })()}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Click for details</p>
                  </div>
                </div>

                <section className="mb-6 rounded-lg bg-white p-5 shadow-md sm:p-6 lg:mb-8">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-gray-900">User Usage Lookup</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Search by UsOnly user ID, user_ ID, or Monitor visitor ID within the selected date range.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="text"
                          value={usageUserId}
                          onChange={(event) => setUsageUserId(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleSearchUserUsage();
                            }
                          }}
                          placeholder="Enter user ID"
                          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleSearchUserUsage}
                          disabled={userUsageLoading || !apiKey}
                          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {userUsageLoading ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      {userUsageError && (
                        <p className="mt-2 text-sm text-red-600">{userUsageError}</p>
                      )}
                    </div>

                    {userUsage && (
                      <div className="lg:w-[560px] xl:w-[620px]">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-gray-700">UsOnly Content</h4>
                          {userUsage.contentStatsError && (
                            <span className="text-xs text-amber-600">{userUsage.contentStatsError}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Posts</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.totalPosts ?? '-'}</p>
                          </div>
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Images</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.totalImages ?? '-'}</p>
                          </div>
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Comments</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.totalComments ?? '-'}</p>
                          </div>
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Image Posts</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.postsWithImages ?? '-'}</p>
                          </div>
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Map Posts</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.postsWithLocation ?? '-'}</p>
                          </div>
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500">Archived</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{userUsage.contentStats?.archivedPosts ?? '-'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {userUsage && (
                    <div className="mt-6 border-t border-gray-200 pt-5">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700">Identity</h4>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div>
                              <dt className="text-gray-500">Username</dt>
                              <dd className="break-all font-medium text-gray-900">{userUsage.contentStats?.user.username || userUsage.username || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Email</dt>
                              <dd className="break-all font-mono text-xs text-gray-900">{userUsage.contentStats?.user.email || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">UsOnly ID</dt>
                              <dd className="break-all font-mono text-xs text-gray-900">{userUsage.usOnlyUserId || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Monitor ID</dt>
                              <dd className="break-all font-mono text-xs text-gray-900">{userUsage.monitorUserId || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Matched IDs</dt>
                              <dd className="break-all font-mono text-xs text-gray-900">
                                {userUsage.matchedUserIds.length > 0 ? userUsage.matchedUserIds.join(', ') : '-'}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700">Activity</h4>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div>
                              <dt className="text-gray-500">First Seen</dt>
                              <dd className="font-mono text-xs text-gray-900">{userUsage.firstSeenAt || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Last Seen</dt>
                              <dd className="font-mono text-xs text-gray-900">{userUsage.lastSeenAt || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">First Post</dt>
                              <dd className="font-mono text-xs text-gray-900">{userUsage.contentStats?.firstPostAt || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Last Post</dt>
                              <dd className="font-mono text-xs text-gray-900">{userUsage.contentStats?.lastPostAt || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Top Location</dt>
                              <dd className="text-gray-900">{userUsage.locations[0]?.name || '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Top Device</dt>
                              <dd className="text-gray-900">{userUsage.devices[0]?.name || '-'}</dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700">Top Pages</h4>
                          <div className="mt-3 space-y-2">
                            {userUsage.topPages.length > 0 ? userUsage.topPages.slice(0, 5).map((page) => (
                              <div key={page.name} className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate font-mono text-xs text-gray-900">{page.name}</span>
                                <span className="flex-shrink-0 tabular-nums text-gray-500">{page.count}</span>
                              </div>
                            )) : (
                              <p className="text-sm text-gray-400">No page data</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {userUsage.contentStats?.recentPosts && userUsage.contentStats.recentPosts.length > 0 && (
                        <div className="mt-6">
                          <h4 className="mb-3 text-sm font-semibold text-gray-700">Recent Posts</h4>
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-[680px] w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Images</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Archived</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {userUsage.contentStats.recentPosts.map((post) => (
                                  <tr key={post.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{post.createdAt}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{post.date}</td>
                                    <td className="max-w-[180px] truncate px-4 py-3 text-sm text-gray-900">{post.title || '-'}</td>
                                    <td className="px-4 py-3 text-sm tabular-nums text-gray-900">{post.imageCount}</td>
                                    <td className="max-w-[160px] truncate px-4 py-3 text-sm text-gray-900">{post.location || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{post.archivedAt ? 'Yes' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="mt-6">
                        <h4 className="mb-3 text-sm font-semibold text-gray-700">Recent Events</h4>
                        {userUsage.recentEvents.length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-[760px] w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Page</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Browser</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {userUsage.recentEvents.map((event) => (
                                  <tr key={event.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{event.createdAt}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{event.eventName || event.eventType}</td>
                                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-blue-600">{event.pageUrl || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{event.city || event.region || event.country || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{event.deviceType || event.os || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{event.browser || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-gray-200 py-8 text-center text-sm text-gray-400">
                            No events found for this user in the selected date range
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {/* 图表 - 每日访问用户数和每日登录用户数 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                  {/* 每日访问用户数（PV）柱状图 */}
                  <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md sm:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Daily Page Views ({getCurrentMonthStr()})</h3>
                    {stats.viewsByDay && stats.viewsByDay.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fillMissingDates(
                          filterCurrentMonth(stats.viewsByDay),
                          startDate,
                          endDate
                        )}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={formatShortDate}
                            ticks={getXAxisTicks(fillMissingDates(
                              filterCurrentMonth(stats.viewsByDay),
                              startDate,
                              endDate
                            ))}
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

                  {/* 每日独立访客数（UV）柱状图 - 可点击 */}
                  <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md sm:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Daily Unique Visitors ({getCurrentMonthStr()})</h3>
                    {stats.uniqueVisitorsByDay && stats.uniqueVisitorsByDay.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fillMissingDates(
                          filterCurrentMonth(stats.uniqueVisitorsByDay),
                          startDate,
                          endDate
                        )}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={formatShortDate}
                            ticks={getXAxisTicks(fillMissingDates(
                              filterCurrentMonth(stats.uniqueVisitorsByDay),
                              startDate,
                              endDate
                            ))}
                            interval="preserveStartEnd"
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip content={(props) => <CustomTooltip {...props} color="#10B981" />} />
                          <Legend />
                          <Bar 
                            dataKey="count" 
                            fill="#10B981" 
                            name="Unique Visitors"
                            onClick={(data) => handleBarClick('uv', data.date)}
                            style={{ cursor: 'pointer' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                        No data available for this period
                      </div>
                    )}
                  </div>

                  {/* 每日登录用户数柱状图 - 可点击 */}
                  <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md sm:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Daily Active Users ({getCurrentMonthStr()})</h3>
                    {stats.dailyActiveUsers && stats.dailyActiveUsers.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fillMissingDates(
                          filterCurrentMonth(stats.dailyActiveUsers),
                          startDate,
                          endDate
                        )}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={formatShortDate}
                            ticks={getXAxisTicks(fillMissingDates(
                              filterCurrentMonth(stats.dailyActiveUsers),
                              startDate,
                              endDate
                            ))}
                            interval="preserveStartEnd"
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip content={(props) => <CustomTooltip {...props} color="#8B5CF6" />} />
                          <Legend />
                          <Bar 
                            dataKey="count" 
                            fill="#8B5CF6" 
                            name="Active Users"
                            onClick={(data) => handleBarClick('active', data.date)}
                            style={{ cursor: 'pointer' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                        No data available for this period
                      </div>
                    )}
                  </div>

                  {/* IP 地址解析饼状图 - 显示已登录用户的地区分布 */}
                  <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md sm:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Unique Visitors Locations (Top 10 Regions, {getCurrentMonthStr()})</h3>
                    {stats.activeUsersByRegion && stats.activeUsersByRegion.length > 0 ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="h-56 min-w-0 flex-1 sm:h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.activeUsersByRegion}
                                cx="50%"
                                cy="50%"
                                outerRadius={82}
                                fill="#F59E0B"
                                dataKey="count"
                                onClick={(data) => handleRegionClick(data.name)}
                                style={{ cursor: 'pointer' }}
                              >
                                {stats.activeUsersByRegion.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={PieTooltip} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <RegionPieLegend
                          data={stats.activeUsersByRegion}
                          onRegionClick={handleRegionClick}
                        />
                      </div>
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
        </div>

        {/* 右侧详细信息面板 */}
        {selectedCard && (
          <div className="fixed inset-0 z-50 flex h-full max-w-full flex-col overflow-hidden bg-white shadow-2xl sm:left-auto sm:w-[700px] sm:border-l sm:border-gray-200">
            {/* 面板头部 */}
            <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-200 p-4 sm:items-center sm:p-6">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold text-gray-900 sm:text-xl">
                  {getPanelTitle()}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {userDetails.length} users found
                </p>
              </div>
              <button
                onClick={handleClosePanel}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-auto">
              {userDetailsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : userDetails.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No user data available
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  {/* 表格区域 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">User List</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-[620px] w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Browser</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Local Time</th>
                            {selectedCard === 'active' && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {userDetails.map((user, index) => (
                            <tr key={`${user.userId}-${index}`} className="hover:bg-gray-50">
                              <td 
                                className="px-4 py-3 text-sm font-mono cursor-pointer hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                onClick={() => user.userId && handleCopyUserId(user.userId)}
                                title="Click to copy full User ID"
                              >
                                {user.userId != null && user.userId !== '' ? (
                                  <span className="text-gray-900">
                                    {user.userId.slice(0, 10)}...
                                    {copiedUserId === user.userId && (
                                      <span className="ml-1 text-xs text-green-600 font-normal">✓ Copied!</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{user.city}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{user.deviceType}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{user.browser}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">{user.localTime}</td>
                              {selectedCard === 'active' && (
                                <td className="px-4 py-3 text-sm text-blue-600 max-w-[120px] truncate">
                                  {user.pageUrl || '-'}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 饼图区域 - 垂直排列 3 行 */}
                  <div className="flex flex-col gap-4">
                    {/* City 分布饼图 */}
                    <div className={`${selectedRegion ? 'hidden' : ''} border border-gray-200 rounded-lg p-4`}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">City Distribution</h3>
                      {cityDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={cityDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={renderPieLabel}
                              outerRadius={80}
                              fill="#3B82F6"
                              dataKey="count"
                            >
                              {cityDistribution.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={PieTooltip} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                          No city data
                        </div>
                      )}
                    </div>

                    {/* Device 分布饼图 */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Device Distribution</h3>
                      {deviceDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={deviceDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={renderPieLabel}
                              outerRadius={80}
                              fill="#3B82F6"
                              dataKey="count"
                            >
                              {deviceDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={DEVICE_COLORS[entry.name as keyof typeof DEVICE_COLORS] || COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={PieTooltip} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                          No device data
                        </div>
                      )}
                    </div>

                    {/* Page 分布饼图（仅 Active Users 显示） */}
                    {selectedCard === 'active' && pageDistribution.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Page Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pageDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={renderPieLabel}
                              outerRadius={80}
                              fill="#3B82F6"
                              dataKey="count"
                            >
                              {pageDistribution.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={PieTooltip} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
