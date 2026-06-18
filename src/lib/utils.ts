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
  // 使用 toLocaleDateString 指定时区转换为北京时间
  return date.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

/**
 * 将 UTC 日期转换为北京时间 (UTC+8) 并格式化为 YYYY-MM-DD HH:mm:ss
 * @param date - UTC 日期对象
 * @returns 北京时间格式的日期时间字符串 (YYYY-MM-DD HH:mm:ss)
 */
export function formatAsBeijingDateTime(date: Date): string {
  const beijingDateStr = formatAsBeijingDate(date);
  const timeStr = date.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return `${beijingDateStr} ${timeStr}`;
}

/**
 * 时区偏移映射（小时）
 * 根据城市/国家推断时区偏移
 * 
 * @param city - 城市名称
 * @param country - 国家名称
 * @returns 时区偏移（小时数，UTC+8 返回 8，UTC-5 返回 -5）
 */
export function getTimezoneOffset(city: string | null, country: string | null): number {
  if (!city && !country) return 0; // 默认 UTC

  const cityLower = city?.toLowerCase() || '';
  const countryLower = country?.toLowerCase() || '';

  // 美国城市
  const usEastCities = ['new york', 'ashburn', 'manassas', 'newark', 'boston', 'philadelphia', 'washington'];
  const usWestCities = ['los angeles', 'san francisco', 'seattle', 'portland', 'san diego'];
  const usCentralCities = ['chicago', 'dallas', 'houston', 'minneapolis'];
  
  if (usEastCities.some(c => cityLower.includes(c))) return -5; // 美国东部 (EST)
  if (usWestCities.some(c => cityLower.includes(c))) return -8; // 美国西部 (PST)
  if (usCentralCities.some(c => cityLower.includes(c))) return -6; // 美国中部 (CST)
  if (countryLower === 'united states' || countryLower === 'usa') return -5; // 默认美国东部

  // 中国
  if (countryLower === 'china' || cityLower.includes('shanghai') || cityLower.includes('beijing') || cityLower.includes('shenzhen')) return 8;

  // 日本
  if (countryLower === 'japan' || cityLower.includes('tokyo') || cityLower.includes('shinagawa')) return 9;

  // 台湾
  if (countryLower === 'taiwan' || cityLower.includes('taipei')) return 8;

  // 韩国
  if (countryLower === 'south korea' || cityLower.includes('seoul')) return 9;

  // 新加坡
  if (countryLower === 'singapore') return 8;

  // 英国
  if (countryLower === 'united kingdom' || countryLower === 'uk' || cityLower.includes('london')) return 0;

  // 欧洲 (默认巴黎时区)
  const europeanCountries = ['germany', 'france', 'italy', 'spain', 'netherlands'];
  if (europeanCountries.some(c => countryLower.includes(c))) return 1;

  // 澳大利亚东部
  if (countryLower === 'australia' || cityLower.includes('sydney') || cityLower.includes('melbourne')) return 10;

  // 默认返回 0 (UTC)
  return 0;
}

/**
 * 将 UTC 时间转换为指定时区的本地时间
 * 
 * @param utcDate - UTC 日期对象
 * @param offset - 时区偏移（小时数）
 * @returns 本地时间格式的日期时间字符串 (YYYY-MM-DD HH:mm:ss)
 */
export function convertUTCToLocalTime(utcDate: Date, offset: number): string {
  const localTime = new Date(utcDate.getTime() + offset * 60 * 60 * 1000);
  const year = localTime.getUTCFullYear();
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localTime.getUTCDate()).padStart(2, '0');
  const hours = String(localTime.getUTCHours()).padStart(2, '0');
  const minutes = String(localTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(localTime.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 解析北京时间（UTC+8）日期字符串为 UTC 时间范围
 * 用于将前端传递的日期字符串（如 '2026-04-19'）转换为数据库查询所需的 UTC 时间范围
 * 
 * @param dateStr - 北京时间日期字符串 (YYYY-MM-DD)
 * @returns 包含 UTC 时间开始和结束的对象 { start: Date, end: Date }
 */
export function parseBeijingDateRange(dateStr: string): { start: Date; end: Date } {
  // 北京时间 00:00:00 = UTC 时间前一天 16:00:00 (UTC-8)
  // 例如：北京时间 2026-04-19 00:00:00 = UTC 时间 2026-04-18 16:00:00
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  
  // 北京时间 23:59:59 = UTC 时间当天 15:59:59 (UTC-8)
  // 例如：北京时间 2026-04-19 23:59:59 = UTC 时间 2026-04-19 15:59:59
  const end = new Date(`${dateStr}T23:59:59+08:00`);
  
  return { start, end };
}

