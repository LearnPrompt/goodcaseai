import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
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
  turbopack: {
    // Turbopack 靠向上找 lockfile 推断 workspace root。开发机的上级目录（含主目录）
    // 若存在无关的 package-lock.json，root 会被推断到仓库外：模块解析范围放大，
    // 报错路径也变成相对那个目录的形式。钉到配置文件所在目录（即仓库根），
    // 结果不再取决于开发机上仓库之外的文件。
    // 注意：改完本文件要 rm -rf .next 再验，脏缓存会报出误导性的解析错误。
    root: import.meta.dirname,
  },
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
