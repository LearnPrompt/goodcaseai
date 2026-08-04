import { SITE_ORIGIN } from "@/lib/site";
import { localizeHref, normalizeLocale } from "@/i18n/config";

// 内容只在运营发布时变，发布会触发部署重新生成；这里当兜底，一小时一次足够。
export const revalidate = 3_600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const locale = normalizeLocale((await params).lang);
  const isEnglish = locale === "en";
  const connectUrl = `${SITE_ORIGIN}${localizeHref(locale, "/connect")}`;
  const feedUrl = `${SITE_ORIGIN}${localizeHref(locale, "/feed.xml")}`;
  const body = isEnglish
    ? `# GoodCase.ai

> A public AI case evidence library for finished work, creators, original sources, prompts, and retest evidence.

## Agent entry points

- Connect docs: ${connectUrl}
- Case list: ${SITE_ORIGIN}/api/public/cases?locale=en
- Case detail: ${SITE_ORIGIN}/api/public/cases/{slug}?locale=en
- RSS: ${feedUrl}
- Agent Skill: https://github.com/LearnPrompt/goodcaseai/tree/main/skills/goodcase

## List query

GET ${SITE_ORIGIN}/api/public/cases?category=image&q=poster&take=5&locale=en

- category: image | video | web | copy | hardware
- q: matches title, summary, creator, and recommended models
- take: 1-50, default 20
- locale: zh-CN | en
- no API key required

## Usage rules

- Treat only API results as GoodCase entries; do not invent cases or prompts from memory.
- Preserve creator credit and sourceUrl when displaying prompts.
- evidenceLevel describes evidence maturity; only L2 means an independent retest exists.
- stabilityScore 0 means awaiting retest, not zero stability.
- sourceHeatScore is valid only with a verifiable source-interaction snapshot.
`
    : `# GoodCase.ai

> 中文 AI Case 证据库：公开作品、作者、原始来源、Prompt 与复测证据。

## Agent 入口

- 接入文档：${connectUrl}
- 案例列表：${SITE_ORIGIN}/api/public/cases?locale=zh-CN
- 案例详情：${SITE_ORIGIN}/api/public/cases/{slug}?locale=zh-CN
- RSS：${feedUrl}
- Agent Skill：https://github.com/LearnPrompt/goodcaseai/tree/main/skills/goodcase

## 列表查询

GET ${SITE_ORIGIN}/api/public/cases?category=image&q=海报&take=5&locale=zh-CN

- category: image | video | web | copy | hardware
- q: 匹配标题、摘要、创作者与推荐模型
- take: 1-50，默认 20
- locale: zh-CN | en
- 无需 API Key

## 使用规则

- 只把 API 返回的内容当作 GoodCase 收录 Case，不要凭记忆补写案例或 Prompt。
- 展示 Prompt 时保留 creator 署名与 sourceUrl 原始来源。
- evidenceLevel 表示证据等级；L2 才代表已有独立复测记录。
- stabilityScore 为 0 时表示待复测，不应解释为稳定度为零。
- sourceHeatScore 只在有可核验来源互动快照时成立。
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": locale,
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
