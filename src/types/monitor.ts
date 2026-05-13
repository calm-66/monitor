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
    dailyRegisteredUsers?: DailyActiveUser[]; // 每日注册用户数（30 天）
    dailyActiveUsers?: DailyActiveUser[]; // 每日登录用户数（30 天）
    postingUsersToday?: number;
    postsToday?: number;
    commentsToday?: number;
    imagesToday?: number;
    totalPosts?: number;
    totalComments?: number;
    totalImages?: number;
  };
}

// 项目配置
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  apiKey: string;
  domain?: string | null;   // 项目域名（如 'usonly-preview.vercel.app' 或 'usonly.com'）
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 事件上报请求体
export interface EventPayload {
  eventType: 'pageview' | 'click' | 'custom' | 'login';
  eventName?: string;
  sessionId?: string;
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  userId?: string;
  ipAddress?: string; // 可选的客户端 IP 地址（由 UsOnly 传递）
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  createdAt?: string; // ISO 格式的日期时间字符串（包含时区信息，由浏览器生成）
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

// 地区分布数据（用于饼图）
export interface RegionData {
  name: string;
  count: number;
}

// 统计响应数据
export interface StatsResponse {
  uniqueVisitors: number;
  uniqueVisitorsByDay: Array<{ date: string; count: number }>; // 每日 UV
  dailyActiveUsers?: DailyActiveUser[]; // 每日登录用户数（30 天）- 从 Event 表统计
  topPages: Array<{ page: string; count: number }>;
  ipResolveStats: {
    totalRequests: number;
    successfulResolves: number;
    rateLimitedCount: number;
    failedCount: number;
    rateLimitedRatio: number; // 被限流比例
  };
  // 按地区分组数据（用于饼图，前 10 个地区）- 仅已登录用户事件
  activeUsersByRegion?: RegionData[];
  // 外部用户统计（可选）
  externalUserStats?: {
    totalUsers: number;
    newUsersToday?: number;
    newUsersThisWeek?: number;
    newUsersThisMonth?: number;
    dailyRegisteredUsers?: DailyActiveUser[]; // 每日注册用户数（30 天）
    dailyActiveUsers?: DailyActiveUser[]; // 每日登录用户数（30 天）
    postingUsersToday?: number;
    postsToday?: number;
    commentsToday?: number;
    imagesToday?: number;
    totalPosts?: number;
    totalComments?: number;
    totalImages?: number;
    todayPostingUsers?: number;
    todayPosts?: number;
    todayComments?: number;
    todayImages?: number;
    operationStats?: {
      postingUsersToday?: number;
      postsToday?: number;
      commentsToday?: number;
      imagesToday?: number;
      totalPosts?: number;
      totalComments?: number;
      totalImages?: number;
    };
  };
  // 环境列表（可选）
  environments?: string[];
}

// IP 解析限制追踪（已弃用 - 保留用于向后兼容）
export interface IpLimitStats {
  totalRequests: number;
  successfulResolves: number;
  rateLimitedCount: number;
  failedCount: number;
  rateLimitedRatio: number;
}

// IP 解析统计（替代 IpLimitStats）
export interface IpResolveStats {
  totalRequests: number;
  successfulResolves: number;
  rateLimitedCount: number;
  failedCount: number;
  rateLimitedRatio: number;
}

// 用户详细信息（用于 UV 和 Active Users 详情）
export interface UserDetail {
  userId: string | null;
  city: string;
  deviceType: string; // PC / iPhone / Android / Mobile / Tablet / Other
  browser: string;
  localTime: string;
  pageUrl: string | null;
}

export interface RegisteredUserDetail {
  id: string;
  username: string;
  partnerId: string | null;
  status: 'active' | 'disabled' | 'deletion_pending';
  createdAt: string;
  lastLoginAt: string | null;
}

// 分布数据（用于饼图）
export interface DistributionData {
  name: string;
  count: number;
}

export interface UserUsageRecentEvent {
  id: string;
  eventType: string;
  eventName: string | null;
  pageUrl: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string;
}

export interface UsOnlyContentStats {
  user: {
    id: string;
    username: string;
    email: string;
    createdAt: string;
    lastLoginAt: string | null;
    partnerId: string | null;
    pairedAt: string | null;
  };
  totalPosts: number;
  totalImages: number;
  totalComments: number;
  postsWithImages: number;
  postsWithLocation: number;
  archivedPosts: number;
  firstPostAt: string | null;
  lastPostAt: string | null;
  recentPosts: Array<{
    id: string;
    title: string | null;
    date: string;
    imageCount: number;
    location: string | null;
    archivedAt: string | null;
    createdAt: string;
  }>;
}

export interface UserUsageSummary {
  inputUserId: string;
  matchedUserIds: string[];
  usOnlyUserId: string | null;
  monitorUserId: string | null;
  username: string | null;
  totalEvents: number;
  totalPageViews: number;
  totalLogins: number;
  activeDays: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  topPages: DistributionData[];
  devices: DistributionData[];
  browsers: DistributionData[];
  locations: DistributionData[];
  eventsByDay: Array<{ date: string; count: number }>;
  recentEvents: UserUsageRecentEvent[];
  contentStats: UsOnlyContentStats | null;
  contentStatsError: string | null;
}

export interface UserUsageResponse {
  success: boolean;
  data: UserUsageSummary;
}

// 用户详细信息 API 响应
export interface UserDetailsResponse {
  success: boolean;
  data: {
    users: UserDetail[];
    total: number;
    cityDistribution: DistributionData[];
    deviceDistribution: DistributionData[];
    pageDistribution?: DistributionData[]; // 页面路径分布
  };
}

export interface RegisteredUsersResponse {
  success: boolean;
  data: {
    date: string;
    users: RegisteredUserDetail[];
    total: number;
  };
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

// 登录统计数据
export interface LoginStats {
  totalLogins: number;           // 总登录次数
  uniqueLoginUsers: number;      // 独立登录用户数
  loginsByDay: Array<{ date: string; count: number }>; // 每日登录次数
  uniqueUsersByDay: Array<{ date: string; count: number }>; // 每日独立登录用户数
  loginsByCity: Array<{ city: string; count: number }>; // 城市分布
  loginsByDevice: Array<{ deviceType: string; count: number }>; // 设备类型分布
  loginsByBrowser: Array<{ browser: string; count: number }>; // 浏览器分布
  loginsByOS: Array<{ os: string; count: number }>; // 操作系统分布
  recentLogins: Array<{
    userId: string | null;
    city: string | null;
    country: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    createdAt: Date;
    username?: string;
    usOnlyUserId?: string;
  }>;
}

// 登录统计 API 响应
export interface LoginStatsResponse {
  success: boolean;
  data: LoginStats;
}

// 反馈数据类型
export interface Feedback {
  id: string;
  type: 'suggestion' | 'bug' | 'other';
  content: string;
  isRead?: boolean;
  userEmail?: string | null;  // 用户邮箱（可选）
  userId: string | null;
  timestamp: string | Date;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  createdAt: Date;
}

// 反馈统计数据
export interface FeedbackStats {
  total: number;
  suggestion: number;
  bug: number;
  other: number;
}

// 反馈 API 响应
export interface FeedbackResponse {
  success: boolean;
  data: {
    feedbacks: Feedback[];
    stats: FeedbackStats;
  };
}
