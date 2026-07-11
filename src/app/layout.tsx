import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_DESCRIPTION =
  "creator-first 的 AI 案例学习平台：先看真实 Case，再决定用哪个模型；点赞解锁完整 Prompt。";

export const metadata: Metadata = {
  metadataBase: new URL("https://goodcase.ai"),
  title: {
    default: "GoodCase.ai",
    template: "%s | GoodCase.ai",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
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
        {children}
      </body>
    </html>
  );
}
