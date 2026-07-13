import type { CaseItem } from "@/lib/mock-data";

export type CreatorItem = {
  slug: string;
  name: string;
  bio: string;
  primaryCategory: CaseItem["category"];
  sourceFootprint: string[];
  totalLikes: number;
  totalRemakes: number;
  averageStabilityScore: number;
  averageFavoriteScore: number;
  tags: string[];
  highlightedLabel: "编辑精选" | "值得学习";
  heroCase: CaseItem;
  representativeCases: CaseItem[];
};

const CATEGORY_LABELS: Record<CaseItem["category"], string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程(UI)",
  copy: "AI 文案",
};

function slugifyCreatorName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildCreatorBio(name: string, category: CaseItem["category"], sources: string[], heroCase: CaseItem) {
  const primarySource = sources[0] || "多个平台";
  const secondSource = sources[1];
  const leadModel = heroCase.recommendedModels[0] || "主力模型";

  if (category === "image") {
    return secondSource
      ? `${name} 主攻 AI 生图，${primarySource}和${secondSource}都在稳定更新，惯用 ${leadModel} 出图，布光和质感控制是长项。`
      : `${name} 主攻 AI 生图，${primarySource}更新很勤，惯用 ${leadModel} 出图，布光和质感控制是长项。`;
  }

  if (category === "video") {
    return secondSource
      ? `${name} 短视频节奏抓得准，${primarySource}和${secondSource}两头都在发，${leadModel} 转场用得顺手。`
      : `${name} 短视频节奏抓得准，长期扎根${primarySource}，${leadModel} 转场用得顺手。`;
  }

  if (category === "web") {
    return `${name} 在${primarySource}上持续输出 UI 工程化实践，常搭 ${leadModel} 出方案，方法都带可复现代码。`;
  }

  return `${name} 文案功夫扎实，长期活跃在${primarySource}，惯用 ${leadModel} 打底稿，开场钩子和结尾行动指令都抓得住人。`;
}

function buildCreatorTags(cases: CaseItem[], category: CaseItem["category"]) {
  const tags = new Set<string>([CATEGORY_LABELS[category]]);

  if (cases.some((item) => item.stabilityScore >= 90)) {
    tags.add("稳定输出");
  }

  if (cases.some((item) => item.favoriteScore >= 90)) {
    tags.add("高互动");
  }

  if (cases.some((item) => item.costBand === "low")) {
    tags.add("低成本可学");
  }

  if (cases.some((item) => item.costBand === "high")) {
    tags.add("高完成度");
  }

  return Array.from(tags).slice(0, 4);
}

export function deriveCreatorsFromCases(caseList: CaseItem[]): CreatorItem[] {
  const grouped = new Map<string, CaseItem[]>();

  for (const item of caseList) {
    const key = item.creator.trim();
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([name, items]) => {
      const representativeCases = [...items]
        .sort((a, b) => b.favoriteScore + b.stabilityScore - (a.favoriteScore + a.stabilityScore))
        .slice(0, 3);
      const heroCase = representativeCases[0] || items[0];
      const sourceFootprint = Array.from(new Set(items.map((item) => item.source)));
      const primaryCategory = heroCase.category;
      const totalLikes = items.reduce((sum, item) => sum + item.likedCount, 0);
      const totalRemakes = items.reduce((sum, item) => sum + item.remakeCount, 0);
      const averageStabilityScore = Math.round(
        items.reduce((sum, item) => sum + item.stabilityScore, 0) / items.length
      );
      const averageFavoriteScore = Math.round(
        items.reduce((sum, item) => sum + item.favoriteScore, 0) / items.length
      );
      const highlightedLabel =
        averageFavoriteScore >= averageStabilityScore ? "编辑精选" : "值得学习";

      return {
        slug: slugifyCreatorName(name),
        name,
        bio: buildCreatorBio(name, primaryCategory, sourceFootprint, heroCase),
        primaryCategory,
        sourceFootprint,
        totalLikes,
        totalRemakes,
        averageStabilityScore,
        averageFavoriteScore,
        tags: buildCreatorTags(items, primaryCategory),
        highlightedLabel,
        heroCase,
        representativeCases,
      } satisfies CreatorItem;
    })
    .sort((a, b) => {
      const scoreA = a.averageFavoriteScore + a.averageStabilityScore + a.totalLikes / 100;
      const scoreB = b.averageFavoriteScore + b.averageStabilityScore + b.totalLikes / 100;
      return scoreB - scoreA;
    });
}

export function findCreatorBySlug(creators: CreatorItem[], slug: string) {
  return creators.find((item) => item.slug === slug) || null;
}

export function findCreatorByName(creators: CreatorItem[], name: string) {
  return creators.find((item) => item.name === name) || null;
}
