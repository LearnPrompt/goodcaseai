import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    globalNotFound: true,
  },
  images: {
    // 数据库中的 media_url / poster_url 可能是任意 https 外链（当前主要是本地 /media/），
    // 放开 https 通配以免运行时因未知域名报错；本地路径不受影响。
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // 测试站单独部署时没有独立的图片优化额度，/_next/image 会整站返回
    // 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED，缩略图全挂。
    // 只在测试环境关掉优化直出原图；生产不设这个变量，行为完全不变。
    unoptimized: process.env.GOODCASE_UNOPTIMIZED_IMAGES === "1",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
