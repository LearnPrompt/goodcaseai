import type { CreatorCardItem } from "@/components/creator-card";
import type { CreatorItem } from "@/lib/creators";

/**
 * 从完整 CreatorItem 里挑出卡片真正要渲染的字段。
 *
 * 必须放在这个普通模块里，不能挂在 creator-card.tsx 上：那个文件是 "use client"，
 * 从服务端组件调用它导出的普通函数会在运行期报
 * 「Attempted to call toCreatorCardItem() from the server」——
 * tsc / eslint / next build 都不会报这个错，只有真跑起来才炸。
 *
 * 为什么要挑而不是直接 {...creator}：CreatorItem 上挂着 heroCase（完整 CaseItem，
 * 含 promptFull / resultBreakdown）和 representativeCases（一整数组完整 CaseItem）。
 * 客户端组件的 props 会被原样序列化进 RSC payload，整个传进去等于把几十 KB
 * 卡片根本不渲染的 Prompt 正文塞进 HTML。
 */
export function toCreatorCardItem(creator: CreatorItem): CreatorCardItem {
  return {
    slug: creator.slug,
    name: creator.name,
    avatarUrl: creator.avatarUrl,
    bio: creator.bio,
    // 卡片只显示前两个标签，多余的没必要序列化。
    tags: creator.tags.slice(0, 2),
    highlightedLabel: creator.highlightedLabel,
    caseCount: creator.caseCount,
    averageSourceHeatScore: creator.averageSourceHeatScore,
    averageStabilityScore: creator.averageStabilityScore,
    heroCaseSlug: creator.heroCase.slug,
    heroCaseTitle: creator.heroCase.title,
    heroCaseSummary: creator.heroCase.summary,
  };
}
