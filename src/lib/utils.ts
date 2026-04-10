import { customAlphabet } from 'nanoid';

// 生成 API Key (使用 nanoid 生成安全的随机字符串)
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 32);

export function generateApiKey(): string {
  return `mk_${nanoid()}`; // mk_ 前缀表示 monitor key
}

// 格式化日期为 YYYY-MM-DD
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化日期为 ISO 字符串（按天分组用）
export function formatDateKey(date: Date): string {
  return formatDate(date);
}

// 验证项目 ID 格式 (UUID)
export function isValidProjectId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// 从请求头获取客户端 IP
export function getClientIP(headers: { get: (name: string) => string | null }): string | null {
  // 检查 x-forwarded-for (可能有多个 IP，取第一个)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    return ips[0]?.trim() || null;
  }
  
  // 检查 x-real-ip
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  return null;
}

// 简单的日志函数
export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(logLevel);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex >= currentLevelIndex) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data ? data : '');
  }
}

// 解析日期范围
export function parseDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 将 UTC 日期转换为北京时间 (UTC+8) 并格式化为 YYYY-MM-DD
 * @param date - UTC 日期对象
 * @returns 北京时间格式的日期字符串 (YYYY-MM-DD)
 */
export function formatAsBeijingDate(date: Date): string {
  // 获取 UTC 时间戳
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  // 添加北京时间偏移 (UTC+8)
  const beijingOffset = 8 * 3600000; // 8 小时
  const beijingTime = new Date(utcTime + beijingOffset);
  // 格式化为 YYYY-MM-DD
  return beijingTime.toISOString().split('T')[0];
}
