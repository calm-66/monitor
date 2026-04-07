import { GeoLocation } from '@/types/monitor';
import { log } from './utils';

// ip-api.com 配置
const IP_API_URL = 'http://ip-api.com/json/';
const RATE_LIMIT = 45; // 每分钟 45 次
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟

// 内存中的请求追踪（生产环境应该使用 Redis 等）
let requestTimestamps: number[] = [];

/**
 * 检查是否超过 ip-api.com 的限流
 */
export async function checkRateLimit(): Promise<boolean> {
  const now = Date.now();
  
  // 清理超过时间窗口的请求记录
  requestTimestamps = requestTimestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  
  // 检查是否超过限流
  return requestTimestamps.length >= RATE_LIMIT;
}

/**
 * 记录一次请求
 */
function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

/**
 * 获取当前请求速率
 */
export function getCurrentRate(): number {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  return requestTimestamps.length;
}

/**
 * 解析 IP 到地理位置（带限流处理）
 */
export async function resolveGeoIP(ip: string): Promise<GeoLocation> {
  if (!ip) {
    return { status: 'fail', message: 'IP address is required' };
  }
  
  // 检查本地 IP
  if (isLocalIP(ip)) {
    return { status: 'success', country: 'Local', region: 'Local', city: 'Local' };
  }
  
  // 检查限流
  const isRateLimited = await checkRateLimit();
  if (isRateLimited) {
    log('warn', `IP API rate limited. Current rate: ${getCurrentRate()}/${RATE_LIMIT}/min`);
    return { 
      status: 'fail', 
      message: 'rate limited',
      country: undefined,
      region: undefined,
      city: undefined
    };
  }
  
  try {
    recordRequest();
    
    const response = await fetch(`${IP_API_URL}${ip}?fields=status,message,country,regionName,city,lat,lon`);
    
    if (!response.ok) {
      throw new Error(`IP API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'fail') {
      log('warn', `IP API failed: ${data.message}`);
      return { 
        status: 'fail', 
        message: data.message || 'Unknown error' 
      };
    }
    
    return {
      status: 'success',
      country: data.country,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon
    };
  } catch (error) {
    log('error', 'Failed to resolve IP location', error);
    return { 
      status: 'fail', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 判断是否是本地 IP
 */
function isLocalIP(ip: string): boolean {
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip.startsWith('192.168.') || 
         ip.startsWith('10.') || 
         ip.startsWith('172.16.') ||
         ip.startsWith('172.17.') ||
         ip.startsWith('172.18.') ||
         ip.startsWith('172.19.') ||
         ip.startsWith('172.2') ||
         ip.startsWith('172.30.') ||
         ip.startsWith('172.31.') ||
         ip === 'localhost';
}

/**
 * 从 User-Agent 解析设备信息
 */
export function parseUserAgent(userAgent?: string): { 
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
} {
  if (!userAgent) {
    return {};
  }
  
  const ua = userAgent.toLowerCase();
  
  // 判断设备类型
  const deviceType = getDeviceType(ua);
  
  // 简单的浏览器检测
  let browser: string | undefined;
  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'IE';
  }
  
  // 简单的操作系统检测
  let os: string | undefined;
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }
  
  return { deviceType, browser, os };
}

/**
 * 判断设备类型
 */
export function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  const ua = userAgent.toLowerCase();
  
  // 平板检测
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  
  // 手机检测
  if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  
  // 默认桌面
  return 'desktop';
}