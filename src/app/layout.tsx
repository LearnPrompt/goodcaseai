import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { SITE_ORIGIN } from "@/lib/site";

const SITE_DESCRIPTION =
  "中文 AI Case 证据库：看真实作品、作者、方法、原始来源与复测证据。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "GoodCase.ai",
    template: "%s | GoodCase.ai",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "GoodCase.ai",
    url: "/",
    title: "GoodCase.ai",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "GoodCase.ai",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body suppressHydrationWarning className="min-h-full">
        <AnalyticsBeacon />
        {children}
      </body>
    </html>
  );
}
