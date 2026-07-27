import { getCaseListData } from "@/lib/cases";
import { localizeHref, normalizeLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "@/lib/site";

export const revalidate = 300;

const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toPubDate(createdAt?: string): string | null {
  if (!createdAt) {
    return null;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toUTCString();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const locale = normalizeLocale((await params).lang);
  const isEnglish = locale === "en";
  const list = await getCaseListData("all", locale);

  const items = [...list]
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, MAX_ITEMS);

  const itemsXml = items
    .map((item) => {
      const link = `${SITE_ORIGIN}${localizeHref(
        locale,
        `/cases/${item.slug}`
      )}`;
      // 只放摘要与 Prompt 预览，绝不输出 promptFull，保持与公开列表 API 一致的暴露面。
      const description = `${item.summary}\n\n${
        isEnglish ? "Prompt preview" : "Prompt 预览"
      }：${item.promptPreview}`;
      const pubDate = toPubDate(item.createdAt);
      const enclosureUrl = `${SITE_ORIGIN}${localizeHref(
        locale,
        `/cases/${item.slug}/opengraph-image`
      )}`;

      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        pubDate ? `      <pubDate>${escapeXml(pubDate)}</pubDate>` : null,
        `      <enclosure url="${escapeXml(enclosureUrl)}" type="image/png" length="0" />`,
        "    </item>",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>GoodCase.ai</title>
    <link>${SITE_ORIGIN}${localizeHref(locale, "/")}</link>
    <description>${escapeXml(
      isEnglish
        ? "A public AI case evidence library with original sources, credited creators, methods, and retest evidence."
        : "中文 AI Case 证据库：真实出处、创作者署名、方法与复测证据。"
    )}</description>
    <language>${isEnglish ? "en" : "zh-cn"}</language>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Content-Language": locale,
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
