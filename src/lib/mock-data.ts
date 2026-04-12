export type CaseCategory = "image" | "video" | "web" | "copy";

export type CaseItem = {
  slug: string;
  title: string;
  category: CaseCategory;
  source: string;
  creator: string;
  summary: string;
  promptPreview: string;
  promptFull: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  likedCount: number;
  remakeCount: number;
  stabilityScore: number;
  favoriteScore: number;
  recommendedModels: string[];
  costBand: "low" | "medium" | "high";
};

export const caseItems: CaseItem[] = [
  {
    slug: "brand-kv-style-transfer",
    title: "品牌海报风格迁移",
    category: "image",
    source: "小红书",
    creator: "视觉实验室",
    summary:
      "适合做 AI 喜爱榜的头部内容。成品完成度高，用户愿意为 Prompt 点赞，且方便拆成结构化图像 Prompt。",
    promptPreview:
      "请生成一张高质感品牌海报，保留主体产品的商业摄影质感，背景采用高级暖调布光，并强调材质细节。",
    promptFull:
      "你是一位商业广告摄影导演。请基于我上传的产品图生成品牌海报，输出要求：\n1) 主体产品比例保持真实，不改变品牌识别元素。\n2) 背景采用暖调棚拍布光，主体边缘有轮廓光。\n3) 材质细节清晰，画面整体偏高端杂志质感。\n4) 构图为竖版 4:5，保留顶部标题区与底部卖点区。\n5) 负向约束：避免塑料感、避免过饱和、避免文字乱码。",
    mediaType: "image",
    mediaUrl: "/media/lead.jpeg",
    likedCount: 4830,
    remakeCount: 1260,
    stabilityScore: 92,
    favoriteScore: 96,
    recommendedModels: ["GPT Image", "Gemini Flash Image", "Qwen Image"],
    costBand: "medium",
  },
  {
    slug: "ai-transition-short-video",
    title: "AI 转场短片 Prompt",
    category: "video",
    source: "抖音",
    creator: "镜头工场",
    summary:
      "视频型内容抓眼，适合放在首页和案例页前排，用来带动点赞解锁和社区讨论。",
    promptPreview:
      "围绕人物主体设计一个流畅转场镜头，保留强烈速度感和空间变化，整体风格偏电影化。",
    promptFull:
      "你是一名短视频导演，请生成 8 秒转场脚本：\n1) 第 0-2 秒为人物近景起势，镜头推进。\n2) 第 2-5 秒通过遮挡切换场景，保持运动连续。\n3) 第 5-8 秒落到产品特写并给出收束动作。\n4) 风格要求：电影感、高对比、轻微运动模糊。\n5) 负向约束：避免卡顿、避免镜头跳轴、避免过度抖动。",
    mediaType: "video",
    mediaUrl: "/media/secondary.mp4",
    posterUrl: "/media/detail.png",
    likedCount: 3910,
    remakeCount: 980,
    stabilityScore: 76,
    favoriteScore: 91,
    recommendedModels: ["Kling", "Runway", "Pika"],
    costBand: "high",
  },
  {
    slug: "landing-page-remix",
    title: "Landing Page 结构复刻",
    category: "web",
    source: "X / Twitter",
    creator: "Build in Public 频道",
    summary:
      "网页案例最适合体现模型差异，既能做稳定榜，也能为用户提供明确的技术选型参考。",
    promptPreview:
      "创建一个高转化产品首页，首屏强调核心价值，页面包含社交证明、案例区和清晰 CTA。",
    promptFull:
      "你是资深产品设计师，请输出 SaaS 落地页结构：\n1) Hero 区：一句话价值主张 + 主 CTA + 次 CTA。\n2) 社交证明区：客户 Logo 与关键指标。\n3) 功能区：3 个核心能力卡片。\n4) 案例区：至少 2 个案例，包含结果数字。\n5) FAQ 与最终 CTA。\n约束：信息层级清晰、文案偏结果导向、避免空泛形容词。",
    mediaType: "image",
    mediaUrl: "/media/detail.png",
    likedCount: 3220,
    remakeCount: 730,
    stabilityScore: 88,
    favoriteScore: 84,
    recommendedModels: ["Claude Sonnet", "GPT-4o", "Gemini Pro"],
    costBand: "medium",
  },
  {
    slug: "voiceover-script-framework",
    title: "爆款口播脚本结构",
    category: "copy",
    source: "公众号",
    creator: "增长研究所",
    summary:
      "文案类 Prompt 最适合先做大样本复测，成本低，能快速产出 AI 稳定榜的第一批可靠数据。",
    promptPreview:
      "请用短视频口播结构重写这段卖点说明，要求前三秒抓人，中段做冲突，结尾保留明确行动指令。",
    promptFull:
      "你是一名短视频编导，请把以下主题改写成 35 秒口播脚本：\n1) 前 3 秒：冲突开场，直接抛痛点。\n2) 中段：给 2 个可验证证据或对比。\n3) 结尾：给 1 个明确行动指令。\n4) 语言要求：口语化、短句、避免空洞赞美。\n5) 输出格式：按 秒数区间 分段展示。",
    mediaType: "image",
    mediaUrl: "/media/lead.jpeg",
    likedCount: 2870,
    remakeCount: 1140,
    stabilityScore: 94,
    favoriteScore: 79,
    recommendedModels: ["Claude Sonnet", "DeepSeek", "Kimi"],
    costBand: "low",
  },
];

export const favoriteLeaderboard = [...caseItems]
  .sort((a, b) => b.favoriteScore - a.favoriteScore)
  .slice(0, 3);

export const stabilityLeaderboard = [...caseItems]
  .sort((a, b) => b.stabilityScore - a.stabilityScore)
  .slice(0, 3);

export const roadmapItems = [
  "先收集 20 到 30 个图像和视频种子案例，验证点赞解锁链路。",
  "优先做图像与文案稳定榜，视频和网页复测放在第二阶段。",
  "登录、点赞、复制 Prompt 和收藏行为统一写入用户事件表。",
  "媒体素材先走 R2，对长视频播放量大时再切 Stream。",
];
