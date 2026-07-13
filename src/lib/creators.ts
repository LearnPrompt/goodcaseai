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

function pickVariant(seed: string, count: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return hash % count;
}

function buildCreatorBio(
  name: string,
  category: CaseItem["category"],
  sources: string[],
  heroCase: CaseItem,
  stabilityScore: number,
  favoriteScore: number
) {
  const primarySource = sources[0] || "多个平台";
  const secondSource = sources[1];
  const leadModel = heroCase.recommendedModels[0] || "主力模型";
  const heroTitle = heroCase.title.replace(/[（(].*?[）)]\s*$/, "").trim();
  const footprint = secondSource ? `${primarySource}和${secondSource}两头都在更新` : `长期扎根${primarySource}`;
  const costPhrase =
    heroCase.costBand === "low" ? "成本压得低" : heroCase.costBand === "high" ? "愿意为质感砸成本" : "成本控制在中等区间";

  const templatesByCategory: Record<CaseItem["category"], Array<(n: string) => string>> = {
    image: [
      (n) => `${n} 主攻 AI 生图，代表作《${heroTitle}》拿下 ${favoriteScore} 分喜爱度，${footprint}，惯用 ${leadModel} 出图。`,
      (n) => `${n} 的图不追求花哨，靠 ${leadModel} 把布光和质感做扎实，《${heroTitle}》复现稳定分 ${stabilityScore}%。`,
      (n) => `${n} ${footprint}，出图节奏很稳，《${heroTitle}》是目前的代表作，${costPhrase}。`,
    ],
    video: [
      (n) => `${n} 短视频节奏抓得准，《${heroTitle}》靠 ${leadModel} 转场拿下 ${favoriteScore} 分喜爱度，${footprint}。`,
      (n) => `${n} ${footprint}，镜头语言干净，代表作《${heroTitle}》复现稳定分 ${stabilityScore}%。`,
      (n) => `${n} 的视频胜在节奏感，《${heroTitle}》用 ${leadModel} 跑出来的，${costPhrase}。`,
    ],
    web: [
      (n) => `${n} 在${primarySource}上持续输出 UI 工程化实践，《${heroTitle}》常搭 ${leadModel} 出方案，方法都带可复现代码。`,
      (n) => `${n} ${footprint}，写的是能跑起来的界面而不是截图，《${heroTitle}》配了完整实现思路。`,
    ],
    copy: [
      (n) => `${n} 文案功夫扎实，${footprint}，《${heroTitle}》的开场钩子和结尾行动指令都抓得住人。`,
      (n) => `${n} 惯用 ${leadModel} 打底稿再手调语感，《${heroTitle}》是这套打法里最有代表性的一条。`,
    ],
  };

  const templates = templatesByCategory[category];
  return templates[pickVariant(name, templates.length)](name);
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
        bio: buildCreatorBio(name, primaryCategory, sourceFootprint, heroCase, averageStabilityScore, averageFavoriteScore),
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
