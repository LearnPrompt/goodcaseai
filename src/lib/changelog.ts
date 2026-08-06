export type ChangelogEntry = {
  date: string;
  title: string;
  items: string[];
  tags?: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-06",
    title: "视频播放全面自托管，卡片排版等高",
    items: [
      "全部案例的视频与封面迁移到站点自有存储，播放不再依赖第三方图床的可达性；加载失败时会明确提示并提供重试和原帖入口。",
      "32 条案例的提示语按原帖补全为完整版——此前部分长提示语被来源方截断，最长的一条从 253 字补到一万余字；对应的方法拆解同步重写。",
      "列表卡片同一行严格等高：标题、摘要、标签区高度固定，提示语块与统计行逐张对齐。",
      "稳定度待复测的案例显示当前催复测票数。",
    ],
    tags: ["体验", "数据"],
  },
  {
    date: "2026-08-05",
    title: "无账号点赞与催复测投票上线",
    items: [
      "点赞从本地假计数改为全站真实计数：无需注册，同一浏览器对同一案例只算一次，跨设备可见。",
      "稳定度缺测的案例可以投票催复测，票数公开累计。",
      "案例详情页并排展示原帖在来源平台的真实点赞数，明确标注为录入时快照，与站内计数互不混淆。",
      "公开 API 新增真实的 likedCount 与 retestVoteCount 字段，Agent 可获取站内互动数据。",
    ],
    tags: ["功能", "透明度"],
  },
  {
    date: "2026-08-05",
    title: "内容溯源治理：下架 33 条对不上原始出处的案例",
    items: [
      "对全部经聚合渠道入库的案例逐条核对原始出处，下架 33 条提示语与原帖对不上（疑似逆向重构或原帖并未公开提示语）的案例。",
      "两条案例换回作者的中文原文提示语，此前展示的英文版转为译文保留。",
      "入库管线新增三道溯源校验：保留来源方的逆向重构标记、带标记的候选不再自动进入待审、入库时自动比对提示语是否出自原帖。",
      "一条创意归属存在公开争议的案例在详情页加注了中性说明。",
    ],
    tags: ["数据", "透明度"],
  },
  {
    date: "2026-08-05",
    title: "全站提速与模型浏览上线正式站",
    items: [
      "案例、创作者、模型页全面提速：案例列表页体积从 4.5MB 降到约 180KB，创作者页从 1.1MB 降到约 97KB。",
      "模型浏览上线：按 Seedance、GPT Image 等模型家族筛选案例，首页新增模型条。",
      "中英双语全站可用，语言切换不再丢失当前页面。",
      "案例列表与创作者列表支持分页；卡片媒体按比例自适应展示，竖版视频与界面截图不再被裁切。",
    ],
    tags: ["体验", "功能"],
  },
  {
    date: "2026-07-28",
    title: "从 Case 派生作者方法与通用 Skill",
    items: [
      "Case 卡片上的作者署名现在可以直接进入创作者页，作者 Case 数按全部已发布作品统计。",
      "同类方法至少出现在 3 个 Case、覆盖 2 位作者后，才会形成跨作者通用 Skill。",
      "同一作者至少有 3 个 Case 重复出现同类做法，才会形成作者方法；来源热度不参与生成门槛。",
      "Skill 有独立可分享证据页，但不进入一级导航，也不成为新的投稿类型。",
    ],
    tags: ["功能", "透明度"],
  },
  {
    date: "2026-07-27",
    title: "运营数据和 Agent 入口补齐",
    items: [
      "内部运营页新增最近 30 天匿名访问、Case 行为、投稿、公开证据与隐藏历史数据总览。",
      "测试反馈会被明确标记并单独归档，不与真实用户建议混在一起。",
      "新增 /llms.txt 机器入口，Agent 可从一个地址发现公开 API、RSS、Skill 与证据使用规则。",
      "公开 API 和案例库补齐 AI 文案、AI 硬件分类的一致支持。",
    ],
    tags: ["运营", "开放"],
  },
  {
    date: "2026-07-25",
    title: "Agent 接入移到顶部，品牌图标统一",
    items: [
      "Agent 接入成为顶部橙色主按钮，并同步进入首页首屏，不再藏在页脚。",
      "更新日志与反馈移到顶部导航；页脚只保留品牌和当前页面说明，链接与普通文字不再混淆。",
      "浏览器 favicon、Apple 图标和站内大拇指标记统一；本地开发页不再显示 Next.js 开发标志。",
    ],
    tags: ["体验", "品牌"],
  },
  {
    date: "2026-07-23",
    title: "喜爱榜改为可追溯的来源互动榜",
    items: [
      "来源互动榜只读取原帖的点赞、评论、转发、收藏与采集时间，不再用静态喜爱分冒充用户偏好。",
      "互动量按“赞 + 2×评论 + 3×转发 + 4×收藏”计算；最终分由平台内互动百分位 60%、互动速度百分位 30% 和数据完整度 10% 组成。",
      "跨平台排名先在各平台内部归一；缺失字段保持为空，不按 0 惩罚。",
      "没有可核验互动快照的 Case 仍可公开，但不会进入来源互动榜。",
    ],
    tags: ["数据", "透明度"],
  },
  {
    date: "2026-07-11",
    title: "搜索、收藏、RSS、接入页、分享海报一起上线",
    items: [
      "案例库支持关键词搜索，输入模型名、玩法或关键词就能直接定位案例。",
      "喜欢的案例可以收藏了，收藏记录保存在本机浏览器，不需要注册账号。",
      "新增 RSS 订阅，地址是 /feed.xml，新案例上线会自动推送到你的阅读器。",
      "新增「接入」页，教你把好案例接进自己的 AI 助手，Skill、RSS、API 三种方式任选。",
      "每个案例都可以生成带二维码的分享海报，转发到群里或朋友圈一张图说清楚。",
    ],
    tags: ["功能"],
  },
  {
    date: "2026-07-10",
    title: "公开 API 和 Skill 上线",
    items: [
      "开放了免费的公开 API，匿名可用、不需要申请 key，两个端点分别拉案例列表和单个案例详情。",
      "发布了 goodcase Skill，装到 Claude 等 AI 助手里，对话中直接查案例、比模型。",
    ],
    tags: ["开放"],
  },
  {
    date: "2026-07-09",
    title: "看案例不用注册了",
    items: [
      "移除了登录墙，全站案例免注册直接看。",
      "完整 Prompt 与复测记录直接公开，点赞只作为本机兴趣标记。",
    ],
    tags: ["体验"],
  },
  {
    date: "2026-05-17",
    title: "好案例上线",
    items: [
      "首批 12 个真实 AI 案例上线，覆盖 AI 视频、AI 编程、AI 图像。",
      "每个案例从三个维度帮你判断值不值得复刻：传播榜看热度，喜爱榜看口碑，稳定榜看能不能稳定复现。",
    ],
    tags: ["发布"],
  },
  {
    date: "2026-07-11",
    title: "接下来",
    items: [
      "稳定分将逐步由 Lab 复测数据驱动，不再只靠人工标注。",
      "案例投稿入口即将开放，你复刻成功的好案例也能收录进来。",
    ],
    tags: ["规划"],
  },
];

export const CHANGELOG_EN: ChangelogEntry[] = [
  {
    date: "2026-08-06",
    title: "Self-hosted video playback and equal-height cards",
    items: [
      "All case videos and posters now live on our own storage — playback no longer depends on third-party CDNs; failed loads show a clear message with retry and a link to the source post.",
      "32 cases had their prompts restored to the full original-post version (some had been truncated upstream; the longest grew from 253 to over 10,000 characters), with method breakdowns rewritten to match.",
      "Cards in the same row are now strictly equal-height: title, summary, and tag zones have fixed heights, and prompt blocks and stat rows align across cards.",
      "Cases awaiting a stability retest now show their current vote count.",
    ],
    tags: ["Experience", "Data"],
  },
  {
    date: "2026-08-05",
    title: "Account-free likes and retest votes",
    items: [
      "Likes are now real site-wide counts instead of local-only numbers: no signup, one count per browser per case, visible across devices.",
      "Cases without a measured stability score accept retest votes, with public running counts.",
      "Detail pages show the source post's real like count alongside, clearly labeled as an ingestion-time snapshot, never mixed into site counts.",
      "The public API gains real likedCount and retestVoteCount fields for agents.",
    ],
    tags: ["Features", "Transparency"],
  },
  {
    date: "2026-08-05",
    title: "Provenance cleanup: 33 cases unpublished",
    items: [
      "Every case ingested via aggregator channels was checked against its original source; 33 whose prompts could not be matched to the source post (likely reverse-engineered, or the author never published a prompt) were unpublished.",
      "Two cases were restored to the author's original Chinese prompt, keeping the previous English version as a translation.",
      "The ingestion pipeline gained three provenance gates: aggregator reverse-engineering markers are preserved, flagged candidates no longer auto-enter review, and prompts are automatically matched against source-post text at ingestion.",
      "One case with a publicly disputed attribution now carries a neutral note on its detail page.",
    ],
    tags: ["Data", "Transparency"],
  },
  {
    date: "2026-08-05",
    title: "Site-wide speedup and model browsing on production",
    items: [
      "Major page-weight cuts: the case list dropped from 4.5MB to about 180KB, creator pages from 1.1MB to about 97KB.",
      "Model browsing launched: filter cases by model family (Seedance, GPT Image, and more), with a model strip on the home page.",
      "Full bilingual support; switching languages keeps you on the current page.",
      "Case and creator lists are paginated; card media adapts to aspect ratio, so vertical videos and UI screenshots are no longer cropped.",
    ],
    tags: ["Experience", "Features"],
  },
  {
    date: "2026-07-28",
    title: "Creator methods and shared Skills derived from Cases",
    items: [
      "Creator credits on Case cards now link directly to creator pages, whose Case count covers all published work.",
      "A shared Skill appears only after the same method is evidenced by at least three Cases across two creators.",
      "A creator method requires at least three matching Cases by the same creator; source popularity is not part of the threshold.",
      "Skills have shareable evidence pages but remain outside the primary navigation and are not a separate submission type.",
    ],
    tags: ["Features", "Transparency"],
  },
  {
    date: "2026-07-27",
    title: "Operator metrics and agent entry points",
    items: [
      "The operator page now summarizes anonymous visits, case activity, submissions, public evidence, and hidden historical data from the last 30 days.",
      "Test feedback is explicitly marked and archived separately from real user suggestions.",
      "Added /llms.txt so agents can discover the public API, RSS, Skill, and evidence-use rules from one address.",
      "The public API and case library now support AI copy and AI hardware categories consistently.",
    ],
    tags: ["Operations", "Open"],
  },
  {
    date: "2026-07-25",
    title: "Agent access moved to the top and brand icons aligned",
    items: [
      "Agent Access is now the orange primary action in the header and home hero.",
      "Changelog and Feedback moved into the top navigation; the footer now contains only the brand and page note.",
      "Browser favicon, Apple icon, and the in-product thumbs-up mark now use one identity.",
    ],
    tags: ["Experience", "Brand"],
  },
  {
    date: "2026-07-23",
    title: "The popularity ranking became a traceable Source Heat Ranking",
    items: [
      "Source Heat reads likes, comments, reposts, saves, and capture time from the original post instead of using a static popularity score.",
      "Interactions use likes + 2×comments + 3×reposts + 4×saves; the final score combines within-platform interaction percentile, velocity, and data completeness.",
      "Cross-platform ranking is normalized within each platform first; missing fields remain null rather than being penalized as zero.",
      "Cases without a verifiable interaction snapshot can remain public but do not enter the ranking.",
    ],
    tags: ["Data", "Transparency"],
  },
  {
    date: "2026-07-11",
    title: "Search, favorites, RSS, Connect, and share posters",
    items: [
      "The case library now supports keyword search across models, methods, and creators.",
      "Favorites are stored locally in the browser and require no account.",
      "Added an RSS feed at /feed.xml, with new cases delivered automatically.",
      "Added the Connect page for Skill, RSS, and API access.",
      "Every case can generate a QR-coded share poster.",
    ],
    tags: ["Features"],
  },
  {
    date: "2026-07-10",
    title: "Open API and Skill launched",
    items: [
      "Released a free public API with anonymous access for case lists and case details.",
      "Released the GoodCase Skill so AI assistants can search and compare cases in conversation.",
    ],
    tags: ["Open"],
  },
  {
    date: "2026-07-09",
    title: "Cases no longer require registration",
    items: [
      "Removed the login wall so every public case is readable without an account.",
      "Full prompts and retest records are public; likes remain a local interest marker.",
    ],
    tags: ["Experience"],
  },
  {
    date: "2026-05-17",
    title: "GoodCase launched",
    items: [
      "The first 12 real AI cases launched across video, coding, and image creation.",
      "Each case surfaces source heat, stability, creators, prompts, and reproducibility signals.",
    ],
    tags: ["Launch"],
  },
  {
    date: "2026-07-11",
    title: "Next",
    items: [
      "Stability scores will increasingly come from Lab retests instead of manual labels.",
      "The submission workflow will continue to improve as more reproducible cases arrive.",
    ],
    tags: ["Roadmap"],
  },
];
