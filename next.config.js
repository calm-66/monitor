/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用严格模式
  reactStrictMode: true,
  
  // 允许的图片域名（如有需要可扩展）
  images: {
    remotePatterns: []
  },
  
  // 环境变量前缀配置
  env: {
    // 从 .env 文件自动读取
  }
};

module.exports = nextConfig;
