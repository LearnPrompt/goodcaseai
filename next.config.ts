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
    // Vercel Hobby 每月只含 5000 次图片转换，且每张图的每个宽度各算一次。
    // 案例列表一页三百多张图，刷几次就打满，之后 /_next/image 全站返回
    // 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED，缩略图变黑块。
    // 因此默认不走优化、直出原图；升级套餐或改用自建缩略图后，
    // 设 GOODCASE_OPTIMIZE_IMAGES=1 即可恢复优化。
    unoptimized: process.env.GOODCASE_OPTIMIZE_IMAGES !== "1",
    // 恢复优化时也要控制变体数量：宽度档位越少，转换次数越省。
    deviceSizes: [640, 1080, 1920],
    imageSizes: [128, 256],
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
