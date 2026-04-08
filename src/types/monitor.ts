// 每日活跃用户数据
export interface DailyActiveUser {
  date: string;
  count: number;
}

// 外部用户统计 API 响应
export interface ExternalUserStats {
  success: boolean;
  data: {
    totalUsers: number;        // 总注册用户数
    newUsersToday?: number;    // 今日新增用户（可选）
    newUsersThisWeek?: number; // 本周新增用户（可选）
    newUsersThisMonth?: number;// 本月新增用户（可选）
    dailyActiveUsers?: DailyActiveUser[]; // 每日登录用户数（30 天）
  };
}

// 项目配置
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  apiKey: string;
  domain?: string | null;
  statsApiUrl?: string | null; // 外部统计 API 地址
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 事件上报请求体
export interface EventPayload {
  eventType: 'pageview' | 'click' | 'custom';
  eventName?: string;
  sessionId?: string;
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  userId?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  metadata?: Record<string, any>;
}

// 解析后的地理位置信息
export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  status?: 'success' | 'fail';
  message?: string; // 错误信息（如 rate limited）
}

// 设备信息
export interface DeviceInfo {
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
}

// 统计响应数据
export interface StatsResponse {
  totalViews: number;
  uniqueVisitors: number;
  viewsByCountry: Array<{ country: string | null; count: number }>;
  viewsByDay: Array<{ date: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  ipResolveStats: {
    totalRequests: number;
    successfulResolves: number;
    rateLimitedCount: number;
    failedCount: number;
    rateLimitedRatio: number; // 被限流比例
  };
  // 外部用户统计（可选）
  externalUserStats?: {
    totalUsers: number;
    newUsersToday?: number;
    newUsersThisWeek?: number;
    newUsersThisMonth?: number;
    dailyActiveUsers?: DailyActiveUser[]; // 每日登录用户数（30 天）
  };
}

// IP 解析限制追踪
export interface IpLimitStats {
  totalRequests: number;
  successfulResolves: number;
  rateLimitedCount: number;
  failedCount: number;
  rateLimitedRatio: number;
}

// API 响应通用类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 健康检查响应
export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  responseTime: number;
  timestamp: string;
}