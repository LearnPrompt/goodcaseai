import type { CaseItem } from "@/lib/mock-data";
import { averageMeasuredStability } from "@/lib/stability";
import type { Locale } from "@/i18n/config";

export type CreatorCaseItem = CaseItem & {
  sourceHeatScore: number | null;
  sourceInteractionCount: number | null;
};

export type CreatorItem = {
  slug: string;
  name: string;
  avatarUrl?: string;
  bio: string;
  primaryCategory: CaseItem["category"];
  sourceFootprint: string[];
  totalSourceInteractions: number;
  averageStabilityScore: number | null;
  averageSourceHeatScore: number | null;
  tags: string[];
  highlightedLabel: string;
  heroCase: CreatorCaseItem;
  representativeCases: CreatorCaseItem[];
};

const CATEGORY_LABELS: Record<CaseItem["category"], string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程(UI)",
  copy: "AI 文案",
  hardware: "AI 硬件",
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
  stabilityScore: number | null,
  sourceHeatScore: number | null,
  locale: Locale
) {
  const primarySource = sources[0] || "多个平台";
  const secondSource = sources[1];
  const leadModel = heroCase.recommendedModels[0] || "主力模型";
  const heroTitle = heroCase.title.replace(/[（(].*?[）)]\s*$/, "").trim();
  const footprint = secondSource ? `${primarySource}和${secondSource}两头都在更新` : `长期扎根${primarySource}`;
  const costPhrase =
    heroCase.costBand === "low" ? "成本压得低" : heroCase.costBand === "high" ? "愿意为质感砸成本" : "成本控制在中等区间";
  const stabilityPhrase =
    stabilityScore === null ? "稳定度待复测" : `复现稳定分 ${stabilityScore}%`;
  const signalPhrase =
    sourceHeatScore === null ? stabilityPhrase : `来源热度 ${sourceHeatScore}`;

  if (locale === "en") {
    const sourceLabel = secondSource
      ? `publishes across ${primarySource} and ${secondSource}`
      : `is active on ${primarySource}`;
    const stabilityLabel =
      stabilityScore === null
        ? "awaiting a stability retest"
        : `with a ${stabilityScore}% stability reference`;
    const categoryFocus = {
      image: "AI image making",
      video: "AI video production",
      web: "production-ready AI interfaces",
      copy: "structured AI copywriting",
      hardware: "AI hardware and software loops",
    }[category];
    return `${name} focuses on ${categoryFocus} and ${sourceLabel}. “${heroTitle}” is the current representative case, built with ${leadModel} ${stabilityLabel}.`;
  }

  const templatesByCategory: Record<CaseItem["category"], Array<(n: string) => string>> = {
    image: [
      (n) => `${n} 主攻 AI 生图，代表作《${heroTitle}》当前${signalPhrase}，${footprint}，惯用 ${leadModel} 出图。`,
      (n) => `${n} 的图不追求花哨，靠 ${leadModel} 把布光和质感做扎实，《${heroTitle}》${stabilityPhrase}。`,
      (n) => `${n} ${footprint}，出图节奏很稳，《${heroTitle}》是目前的代表作，${costPhrase}。`,
    ],
    video: [
      (n) => `${n} 短视频节奏抓得准，《${heroTitle}》靠 ${leadModel} 做出转场，当前${signalPhrase}，${footprint}。`,
      (n) => `${n} ${footprint}，镜头语言干净，代表作《${heroTitle}》${stabilityPhrase}。`,
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
    hardware: [
      (n) => `${n} 在${primarySource}记录 AI 硬件与软件闭环，《${heroTitle}》重点公开交互、隐私边界和验证状态。`,
      (n) => `${n} 把实体动作、macOS 反馈和 AI 处理串成可复测链路，《${heroTitle}》是当前代表 Case。`,
    ],
  };

  const templates = templatesByCategory[category];
  return templates[pickVariant(name, templates.length)](name);
}

function buildCreatorTags(
  cases: CreatorCaseItem[],
  category: CaseItem["category"],
  locale: Locale
) {
  const categoryLabel =
    locale === "en"
      ? {
          image: "AI Image",
          video: "AI Video",
          web: "AI Coding (UI)",
          copy: "AI Copy",
          hardware: "AI Hardware",
        }[category]
      : CATEGORY_LABELS[category];
  const tags = new Set<string>([categoryLabel]);

  if (cases.some((item) => item.stabilityScore >= 90)) {
    tags.add(locale === "en" ? "Stable output" : "稳定输出");
  }

  if (cases.some((item) => (item.sourceHeatScore ?? -1) >= 80)) {
    tags.add(locale === "en" ? "High source heat" : "来源互动高");
  }

  if (cases.some((item) => item.costBand === "low")) {
    tags.add(locale === "en" ? "Low-cost method" : "低成本可学");
  }

  if (cases.some((item) => item.costBand === "high")) {
    tags.add(locale === "en" ? "High finish" : "高完成度");
  }

  return Array.from(tags).slice(0, 4);
}

export function deriveCreatorsFromCases(
  caseList: CreatorCaseItem[],
  locale: Locale = "zh-CN"
): CreatorItem[] {
  const grouped = new Map<string, CreatorCaseItem[]>();

  for (const item of caseList) {
    const key = item.creator.trim();
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([name, items]) => {
      const representativeCases = [...items]
        .sort(
          (a, b) =>
            (b.sourceHeatScore ?? 0) +
            b.stabilityScore -
            ((a.sourceHeatScore ?? 0) + a.stabilityScore)
        )
        .slice(0, 3);
      const heroCase = representativeCases[0] || items[0];
      const sourceFootprint = Array.from(new Set(items.map((item) => item.source)));
      const primaryCategory = heroCase.category;
      const sourceHeatScores = items
        .map((item) => item.sourceHeatScore)
        .filter((score): score is number => typeof score === "number");
      const totalSourceInteractions = items.reduce(
        (sum, item) => sum + (item.sourceInteractionCount ?? 0),
        0
      );
      const averageStabilityScore = averageMeasuredStability(
        items.map((item) => item.stabilityScore)
      );
      const averageSourceHeatScore =
        sourceHeatScores.length > 0
          ? Math.round(
              sourceHeatScores.reduce((sum, score) => sum + score, 0) /
                sourceHeatScores.length
            )
          : null;
      const highlightedLabel =
        averageSourceHeatScore !== null &&
        (averageStabilityScore === null ||
          averageSourceHeatScore >= averageStabilityScore)
          ? locale === "en"
            ? "Editor’s pick"
            : "编辑精选"
          : locale === "en"
            ? "Worth learning"
            : "值得学习";
      const avatarUrl = heroCase.creatorAvatarUrl || items.find((item) => item.creatorAvatarUrl)?.creatorAvatarUrl;

      return {
        slug: slugifyCreatorName(name),
        name,
        avatarUrl,
        bio: buildCreatorBio(
          name,
          primaryCategory,
          sourceFootprint,
          heroCase,
          averageStabilityScore,
          averageSourceHeatScore,
          locale
        ),
        primaryCategory,
        sourceFootprint,
        totalSourceInteractions,
        averageStabilityScore,
        averageSourceHeatScore,
        tags: buildCreatorTags(items, primaryCategory, locale),
        highlightedLabel,
        heroCase,
        representativeCases,
      } satisfies CreatorItem;
    })
    .sort((a, b) => {
      const scoreA =
        (a.averageSourceHeatScore ?? 0) +
        (a.averageStabilityScore ?? 0) +
        a.totalSourceInteractions / 100;
      const scoreB =
        (b.averageSourceHeatScore ?? 0) +
        (b.averageStabilityScore ?? 0) +
        b.totalSourceInteractions / 100;
      return scoreB - scoreA;
    });
}

export function findCreatorBySlug(creators: CreatorItem[], slug: string) {
  return creators.find((item) => item.slug === slug) || null;
}

export function findCreatorByName(creators: CreatorItem[], name: string) {
  return creators.find((item) => item.name === name) || null;
}
