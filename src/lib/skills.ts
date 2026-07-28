import type { Locale } from "@/i18n/config";
import type { CaseCategory } from "@/lib/mock-data";

type LocalizedText = Record<Locale, string>;

export type SkillCaseInput = {
  slug: string;
  title: string;
  category: CaseCategory;
  creator: string;
  tags?: string[];
  sourceUrl?: string;
  summary?: string;
  promptPreview?: string;
  promptFull?: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
  posterUrl?: string;
};

export type SkillCreatorEvidence = {
  name: string;
  caseCount: number;
};

export type SkillLink = {
  slug: string;
  title: string;
  kind: "shared" | "creator_method";
};

export type DerivedSkill<T extends SkillCaseInput = SkillCaseInput> = {
  slug: string;
  baseSlug: string;
  kind: "shared" | "creator_method";
  title: string;
  description: string;
  category: CaseCategory;
  methodSteps: string[];
  cases: T[];
  creators: SkillCreatorEvidence[];
  caseCount: number;
  creatorCount: number;
  generalSkillSlug: string | null;
};

export type SkillCatalog<T extends SkillCaseInput = SkillCaseInput> = {
  sharedSkills: DerivedSkill<T>[];
  creatorMethods: DerivedSkill<T>[];
  allSkills: DerivedSkill<T>[];
};

type SkillDefinition = {
  slug: string;
  category: CaseCategory;
  title: LocalizedText;
  description: LocalizedText;
  methodSteps: Record<Locale, string[]>;
  signals: RegExp;
  priority: number;
};

const SHARED_MIN_CASES = 3;
const SHARED_MIN_CREATORS = 2;
const CREATOR_METHOD_MIN_CASES = 3;
const CREATOR_METHOD_LIMIT = 2;
const MAX_CASE_SKILLS = 2;

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  {
    slug: "editorial-portrait-composition",
    category: "image",
    title: {
      "zh-CN": "编辑肖像构图",
      en: "Editorial portrait composition",
    },
    description: {
      "zh-CN": "用人物姿态、造型、光线和留白，构成可重复迁移的编辑人像。",
      en: "Build repeatable editorial portraits from pose, styling, light, and negative space.",
    },
    methodSteps: {
      "zh-CN": ["先定人物身份与情绪", "明确景别、姿态和视线", "锁定光线、材质与背景留白"],
      en: ["Set identity and emotion", "Specify framing, pose, and gaze", "Lock light, texture, and negative space"],
    },
    signals: /(肖像|人像|时尚|fashion|portrait|editorial|写真|偶像|模特|美妆)/i,
    priority: 35,
  },
  {
    slug: "poster-information-hierarchy",
    category: "image",
    title: {
      "zh-CN": "海报信息层级",
      en: "Poster information hierarchy",
    },
    description: {
      "zh-CN": "把主视觉、标题、辅助信息和版式约束写成一套可替换的海报骨架。",
      en: "Turn the hero visual, headline, support copy, and layout constraints into a reusable poster frame.",
    },
    methodSteps: {
      "zh-CN": ["先写主标题与视觉中心", "约束版式网格和文字层级", "最后补色彩、纹理与输出规格"],
      en: ["Set the headline and visual center", "Constrain the grid and type hierarchy", "Add color, texture, and output specs"],
    },
    signals: /(海报|poster|信息图|infographic|拼贴|collage|封面|cover|排版|typography|邀请函)/i,
    priority: 40,
  },
  {
    slug: "product-studio-visual",
    category: "image",
    title: {
      "zh-CN": "产品视觉棚拍",
      en: "Product studio visual",
    },
    description: {
      "zh-CN": "围绕产品主体、材质、布光和商业场景组织可复用的静物视觉。",
      en: "Organize reusable product stills around the object, material, lighting, and commercial setting.",
    },
    methodSteps: {
      "zh-CN": ["锁定产品形态与材质", "定义机位、光比和反射", "补品牌场景与商业留白"],
      en: ["Lock product form and material", "Define camera, light ratio, and reflections", "Add brand context and commercial space"],
    },
    signals: /(产品|商品|product|packaging|静物|香水|skincare|护肤|logo|电商|商业|广告)/i,
    priority: 45,
  },
  {
    slug: "character-style-consistency",
    category: "image",
    title: {
      "zh-CN": "角色设定与风格统一",
      en: "Character and style consistency",
    },
    description: {
      "zh-CN": "用角色特征、服装道具、世界观和画风约束保持同一角色的一致性。",
      en: "Keep a character coherent through traits, costume, props, worldbuilding, and style constraints.",
    },
    methodSteps: {
      "zh-CN": ["固定角色识别特征", "补服装、道具与动作", "用画风和世界观约束统一输出"],
      en: ["Fix identifying traits", "Add costume, props, and action", "Unify output with style and world constraints"],
    },
    signals: /(动漫|anime|角色|character|漫画|奇幻|fantasy|插画|illustration|卡牌|扑克牌|3d cg)/i,
    priority: 42,
  },
  {
    slug: "product-ad-shot-design",
    category: "video",
    title: {
      "zh-CN": "产品广告镜头",
      en: "Product ad shot design",
    },
    description: {
      "zh-CN": "从产品卖点出发，编排开场钩子、使用场景和品牌收束镜头。",
      en: "Turn a product benefit into an opening hook, usage scene, and branded closing shot.",
    },
    methodSteps: {
      "zh-CN": ["先确定单一产品卖点", "用动作或场景证明卖点", "以品牌特写或行动指令收束"],
      en: ["Choose one product benefit", "Prove it through action or context", "Close on brand detail or a call to action"],
    },
    signals: /(广告|商业|产品|product|commercial|品牌|brand|美妆|口红|饮料|汽水|咖啡|护肤|soda|ugc)/i,
    priority: 45,
  },
  {
    slug: "action-continuity-choreography",
    category: "video",
    title: {
      "zh-CN": "动作连续性编排",
      en: "Action continuity choreography",
    },
    description: {
      "zh-CN": "把角色、运动方向、节奏和镜头衔接写成可复现的动作序列。",
      en: "Make action reproducible by specifying character, direction, rhythm, and shot continuity.",
    },
    methodSteps: {
      "zh-CN": ["固定角色与运动方向", "拆分起势、冲突和收束", "逐镜约束机位、速度与连续性"],
      en: ["Fix character and movement direction", "Split setup, conflict, and resolution", "Constrain camera, speed, and continuity shot by shot"],
    },
    signals: /(战斗|对决|动作|武术|功夫|追逐|fight|battle|action|chase|剑|骑士|战争|坠落|跑酷)/i,
    priority: 50,
  },
  {
    slug: "pov-vlog-presence",
    category: "video",
    title: {
      "zh-CN": "POV / Vlog 临场感",
      en: "POV and vlog presence",
    },
    description: {
      "zh-CN": "用第一视角、手持运动和生活化细节制造可信的在场感。",
      en: "Create credible presence through first-person framing, handheld movement, and lived-in detail.",
    },
    methodSteps: {
      "zh-CN": ["明确拍摄者身份与设备", "写出移动路径和偶发细节", "保留手持瑕疵与真实环境声画"],
      en: ["Define the shooter and device", "Write the movement path and incidental detail", "Keep handheld imperfection and environmental texture"],
    },
    signals: /(vlog|pov|fpv|自拍|手持|探店|纪录片|日常|回忆|journey|生活方式|网红|直播|骑行)/i,
    priority: 48,
  },
  {
    slug: "process-transformation-story",
    category: "video",
    title: {
      "zh-CN": "过程与变换叙事",
      en: "Process and transformation story",
    },
    description: {
      "zh-CN": "用明确起点、连续步骤和终态，把制作或变化过程压缩成可读叙事。",
      en: "Compress making or transformation into a readable story with a clear start, continuous steps, and end state.",
    },
    methodSteps: {
      "zh-CN": ["先定义起点与最终结果", "挑出必须看见的中间步骤", "用同机位或连续动作连接变化"],
      en: ["Define the start and final state", "Select the essential intermediate steps", "Connect change with a stable camera or continuous action"],
    },
    signals: /(烹饪|制作|烘焙|cooking|baking|recipe|过程|流程|延时|time.?lapse|变换|改造|自建)/i,
    priority: 44,
  },
  {
    slug: "animation-style-consistency",
    category: "video",
    title: {
      "zh-CN": "动画风格与角色一致性",
      en: "Animation style and character consistency",
    },
    description: {
      "zh-CN": "在多镜头动画中固定角色造型、运动语言和材质画风。",
      en: "Keep character design, movement language, and visual texture stable across animated shots.",
    },
    methodSteps: {
      "zh-CN": ["固定角色设定表", "统一动作节奏和镜头语法", "重复声明材质、线条与色彩规则"],
      en: ["Fix a character sheet", "Unify motion rhythm and shot grammar", "Repeat material, line, and color rules"],
    },
    signals: /(动漫|anime|动画|animation|皮克斯|pixar|吉卜力|ghibli|定格|stop.?motion|2d|3d)/i,
    priority: 30,
  },
  {
    slug: "landing-page-information-structure",
    category: "web",
    title: {
      "zh-CN": "落地页信息结构",
      en: "Landing-page information structure",
    },
    description: {
      "zh-CN": "把价值主张、证据、功能与行动指令排成一条完整的页面阅读路径。",
      en: "Arrange value proposition, proof, features, and calls to action into one complete page journey.",
    },
    methodSteps: {
      "zh-CN": ["首屏只讲一个价值主张", "按问题、证据、功能组织模块", "让每段内容导向同一行动"],
      en: ["Keep one value proposition above the fold", "Order problem, proof, and features", "Make every section lead to one action"],
    },
    signals: /(落地页|landing|官网|网站|site|产品站|waitlist|startup|单页|多页|网页)/i,
    priority: 20,
  },
  {
    slug: "web-3d-motion-hero",
    category: "web",
    title: {
      "zh-CN": "3D / 动效 Hero",
      en: "3D and motion hero",
    },
    description: {
      "zh-CN": "用单一视觉主角、滚动或交互节奏和性能边界组织网页首屏动效。",
      en: "Build a motion-led hero around one visual subject, an interaction rhythm, and a clear performance budget.",
    },
    methodSteps: {
      "zh-CN": ["先定唯一视觉主角", "写清滚动或交互触发关系", "限制首屏资源与移动端降级"],
      en: ["Choose one visual protagonist", "Specify scroll or interaction triggers", "Limit first-load assets and mobile fallback"],
    },
    signals: /(3d|webgl|three\.js|动效|动画|animation|滚动|scroll|电影感|cinematic|hero|交互)/i,
    priority: 50,
  },
  {
    slug: "portfolio-story-architecture",
    category: "web",
    title: {
      "zh-CN": "个人作品集叙事",
      en: "Portfolio story architecture",
    },
    description: {
      "zh-CN": "围绕创作者定位、代表作品和可信证据安排个人站的叙事顺序。",
      en: "Order a personal site around positioning, representative work, and trust evidence.",
    },
    methodSteps: {
      "zh-CN": ["一句话说清创作者定位", "用代表作品而非技能清单证明能力", "补过程、客户或联系方式形成闭环"],
      en: ["State the creator position in one line", "Prove ability with work, not skill lists", "Close with process, clients, or contact"],
    },
    signals: /(作品集|portfolio|个人|机构|studio|agency|档案|摄影师|导演|品牌)/i,
    priority: 45,
  },
  {
    slug: "product-commerce-conversion-page",
    category: "web",
    title: {
      "zh-CN": "产品与电商转化页",
      en: "Product and commerce conversion page",
    },
    description: {
      "zh-CN": "把商品或 SaaS 的选择、信任和购买路径压缩成清晰的转化界面。",
      en: "Compress selection, trust, and purchase into a clear conversion path for a product or SaaS.",
    },
    methodSteps: {
      "zh-CN": ["首屏明确产品与适用人群", "提前解决价格、信任和选择阻力", "用清晰 CTA 完成购买或注册"],
      en: ["Clarify product and audience above the fold", "Resolve price, trust, and choice friction", "Complete purchase or signup with a clear CTA"],
    },
    signals: /(电商|e.?commerce|shop|购物|订阅|saas|产品|startup|生成器|builder|平台|product)/i,
    priority: 40,
  },
] as const;

function normalizeCreator(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/^@(?=[a-z0-9_])/i, "")
    .toLowerCase();
}

function hashIdentity(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function matchesDefinition(
  definition: SkillDefinition,
  item: SkillCaseInput
) {
  if (item.category !== definition.category) {
    return false;
  }
  return definition.signals.test(
    [item.title, ...(item.tags ?? [])].join(" ")
  );
}

function groupCreators<T extends SkillCaseInput>(cases: T[]) {
  const grouped = new Map<
    string,
    { name: string; cases: T[] }
  >();

  for (const item of cases) {
    const identity = normalizeCreator(item.creator);
    if (!identity) {
      continue;
    }
    const existing = grouped.get(identity);
    if (existing) {
      existing.cases.push(item);
    } else {
      grouped.set(identity, {
        name: item.creator.replace(/^@(?=[a-z0-9_])/i, ""),
        cases: [item],
      });
    }
  }

  return grouped;
}

function overlapRatio<T extends SkillCaseInput>(a: T[], b: T[]) {
  const aSlugs = new Set(a.map((item) => item.slug));
  const bSlugs = new Set(b.map((item) => item.slug));
  const intersection = [...aSlugs].filter((slug) => bSlugs.has(slug)).length;
  const union = new Set([...aSlugs, ...bSlugs]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deriveSkillCatalog<T extends SkillCaseInput>(
  cases: T[],
  locale: Locale = "zh-CN"
): SkillCatalog<T> {
  const sharedSkills = SKILL_DEFINITIONS.flatMap((definition) => {
    const matchingCases = cases.filter((item) =>
      matchesDefinition(definition, item)
    );
    const creators = groupCreators(matchingCases);

    if (
      matchingCases.length < SHARED_MIN_CASES ||
      creators.size < SHARED_MIN_CREATORS
    ) {
      return [];
    }

    return [
      {
        slug: definition.slug,
        baseSlug: definition.slug,
        kind: "shared" as const,
        title: definition.title[locale],
        description: definition.description[locale],
        category: definition.category,
        methodSteps: definition.methodSteps[locale],
        cases: matchingCases,
        creators: [...creators.values()]
          .map((creator) => ({
            name: creator.name,
            caseCount: creator.cases.length,
          }))
          .sort(
            (a, b) =>
              b.caseCount - a.caseCount || a.name.localeCompare(b.name)
          ),
        caseCount: matchingCases.length,
        creatorCount: creators.size,
        generalSkillSlug: null,
      },
    ];
  }).sort(
    (a, b) =>
      b.caseCount - a.caseCount || a.title.localeCompare(b.title, locale)
  );

  const sharedByBaseSlug = new Map(
    sharedSkills.map((skill) => [skill.baseSlug, skill])
  );
  const allCreators = groupCreators(cases);
  const creatorMethods: DerivedSkill<T>[] = [];

  for (const [identity, creator] of allCreators) {
    const candidates = SKILL_DEFINITIONS.flatMap((definition) => {
      const matchingCases = creator.cases.filter((item) =>
        matchesDefinition(definition, item)
      );
      if (
        matchingCases.length < CREATOR_METHOD_MIN_CASES ||
        !sharedByBaseSlug.has(definition.slug)
      ) {
        return [];
      }
      return [{ definition, matchingCases }];
    }).sort(
      (a, b) =>
        b.definition.priority - a.definition.priority ||
        b.matchingCases.length - a.matchingCases.length
    );

    const selected: typeof candidates = [];
    for (const candidate of candidates) {
      if (
        selected.some(
          (existing) =>
            overlapRatio(existing.matchingCases, candidate.matchingCases) >=
            0.7
        )
      ) {
        continue;
      }
      selected.push(candidate);
      if (selected.length >= CREATOR_METHOD_LIMIT) {
        break;
      }
    }

    for (const { definition, matchingCases } of selected) {
      const baseTitle = definition.title[locale];
      creatorMethods.push({
        slug: `${definition.slug}-by-${hashIdentity(identity)}`,
        baseSlug: definition.slug,
        kind: "creator_method",
        title: `${creator.name} · ${baseTitle}`,
        description:
          locale === "en"
            ? `A recurring ${baseTitle.toLowerCase()} method derived from ${matchingCases.length} published cases by ${creator.name}.`
            : `从 ${creator.name} 的 ${matchingCases.length} 个已发布 Case 中归纳出的「${baseTitle}」方法。`,
        category: definition.category,
        methodSteps: definition.methodSteps[locale],
        cases: matchingCases,
        creators: [{ name: creator.name, caseCount: matchingCases.length }],
        caseCount: matchingCases.length,
        creatorCount: 1,
        generalSkillSlug: definition.slug,
      });
    }
  }

  creatorMethods.sort(
    (a, b) =>
      b.caseCount - a.caseCount || a.title.localeCompare(b.title, locale)
  );

  return {
    sharedSkills,
    creatorMethods,
    allSkills: [...sharedSkills, ...creatorMethods],
  };
}

export function getCaseSkillLinks<T extends SkillCaseInput>(
  catalog: SkillCatalog<T>,
  caseSlug: string,
  includeCreatorMethods = false
): SkillLink[] {
  const definitionPriority = new Map(
    SKILL_DEFINITIONS.map((definition) => [
      definition.slug,
      definition.priority,
    ])
  );
  const candidates = [
    ...catalog.sharedSkills,
    ...(includeCreatorMethods ? catalog.creatorMethods : []),
  ].filter((skill) => skill.cases.some((item) => item.slug === caseSlug));

  return candidates
    .sort(
      (a, b) =>
        (b.kind === "creator_method" ? 1 : 0) -
          (a.kind === "creator_method" ? 1 : 0) ||
        (definitionPriority.get(b.baseSlug) ?? 0) -
          (definitionPriority.get(a.baseSlug) ?? 0) ||
        b.caseCount - a.caseCount
    )
    .slice(0, includeCreatorMethods ? 3 : MAX_CASE_SKILLS)
    .map(({ slug, title, kind }) => ({ slug, title, kind }));
}

export function getCreatorMethods<T extends SkillCaseInput>(
  catalog: SkillCatalog<T>,
  creatorName: string
) {
  const identity = normalizeCreator(creatorName);
  return catalog.creatorMethods.filter(
    (skill) =>
      skill.creators[0] &&
      normalizeCreator(skill.creators[0].name) === identity
  );
}

export function findSkillBySlug<T extends SkillCaseInput>(
  catalog: SkillCatalog<T>,
  slug: string
) {
  return catalog.allSkills.find((skill) => skill.slug === slug) || null;
}
