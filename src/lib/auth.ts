/**
 * 验证 HTTP Basic Auth
 * @param authHeader - Authorization 请求头
 * @param correctPassword - 正确的密码（从环境变量读取）
 */
export function verifyBasicAuth(authHeader: string | null, correctPassword: string): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
  try {
    // 解码 Base64
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    
    // 格式为 username:password
    const [username, password] = decoded.split(':');
    
    // 验证密码（用户名固定为 admin）
    return username === 'admin' && password === correctPassword;
  } catch {
    return false;
  }
}

/**
 * 生成 401 响应（带 WWW-Authenticate 头）
 */
export function getAuthChallengeResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Monitor Dashboard"',
      'Content-Type': 'text/plain'
    }
  });
}

/**
 * 为 Request 对象添加 Basic Auth 验证中间件
 */
export function withBasicAuth(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const correctPassword = process.env.DASHBOARD_PASSWORD;
  
  // 如果没有配置密码，跳过认证（仅开发环境）
  if (!correctPassword || correctPassword === 'your_secure_password_here') {
    console.warn('Warning: DASHBOARD_PASSWORD not configured. Dashboard is unprotected.');
    return handler();
  }
  
  // 验证 Basic Auth
  if (!verifyBasicAuth(authHeader, correctPassword)) {
    return Promise.resolve(getAuthChallengeResponse());
  }
  
  return handler();
}