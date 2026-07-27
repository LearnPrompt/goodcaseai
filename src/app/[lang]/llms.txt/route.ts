import { SITE_ORIGIN } from "@/lib/site";

export const revalidate = 300;

export function GET() {
  const body = `# GoodCase.ai

> 中文 AI Case 证据库：公开作品、作者、原始来源、Prompt 与复测证据。

## Agent 入口

- 接入文档：${SITE_ORIGIN}/connect
- 案例列表：${SITE_ORIGIN}/api/public/cases
- 案例详情：${SITE_ORIGIN}/api/public/cases/{slug}
- RSS：${SITE_ORIGIN}/feed.xml
- Agent Skill：https://github.com/LearnPrompt/goodcaseai/tree/main/skills/goodcase

## 列表查询

GET ${SITE_ORIGIN}/api/public/cases?category=image&q=海报&take=5

- category: image | video | web | copy | hardware
- q: 匹配标题、摘要、创作者与推荐模型
- take: 1-50，默认 20
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
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
