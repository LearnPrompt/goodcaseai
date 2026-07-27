import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { LocaleProvider } from "@/i18n/client";
import { isLocale, localizeHref, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { SITE_ORIGIN } from "@/lib/site";

type LocaleParams = Promise<{ lang: string }>;

async function localeFromParams(params: LocaleParams): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  return lang;
}

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const messages = getMessages(locale);
  const canonical = localizeHref(locale, "/");

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: {
      default: "GoodCase.ai",
      template: "%s | GoodCase.ai",
    },
    description: messages.site.description,
    alternates: {
      canonical,
      languages: {
        "zh-CN": "/",
        en: "/en",
        "x-default": "/",
      },
      types: {
        "application/rss+xml": localizeHref(locale, "/feed.xml"),
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "zh_CN",
      alternateLocale: locale === "en" ? ["zh_CN"] : ["en_US"],
      siteName: "GoodCase.ai",
      url: canonical,
      title: "GoodCase.ai",
      description: messages.site.description,
    },
    twitter: {
      card: "summary_large_image",
      title: "GoodCase.ai",
      description: messages.site.description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: LocaleParams;
}>) {
  const locale = await localeFromParams(params);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body suppressHydrationWarning className="min-h-full">
        <LocaleProvider locale={locale}>
          <AnalyticsBeacon />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
