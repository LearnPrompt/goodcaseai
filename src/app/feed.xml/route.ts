import { getCaseListData } from "@/lib/cases";

export const revalidate = 300;

const SITE_ORIGIN = "https://goodcase.ai";
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

export async function GET() {
  const list = await getCaseListData("all");

  const items = [...list]
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, MAX_ITEMS);

  const itemsXml = items
    .map((item) => {
      const link = `${SITE_ORIGIN}/cases/${item.slug}`;
      // 只放摘要与 Prompt 预览，绝不输出 promptFull，保持与公开列表 API 一致的暴露面。
      const description = `${item.summary}\n\nPrompt 预览：${item.promptPreview}`;
      const pubDate = toPubDate(item.createdAt);
      const enclosureUrl = `${SITE_ORIGIN}/cases/${item.slug}/opengraph-image`;

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
    <link>${SITE_ORIGIN}</link>
    <description>${escapeXml(
      "creator-first 的 AI 案例学习平台：真实出处、创作者署名、Prompt 预览与推荐模型。"
    )}</description>
    <language>zh-cn</language>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
