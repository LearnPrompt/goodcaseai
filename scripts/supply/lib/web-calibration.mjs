const SOURCE_DEFINITIONS = [
  {
    id: "x-claude",
    label: "X · Claude / Opus",
    note: "创作者原帖中的网页成品、工作流或 Prompt 证据。",
  },
  {
    id: "x-lovable",
    label: "X · Lovable",
    note: "创作者明确声明使用 Lovable，并展示网页或 Web App 结果。",
  },
  {
    id: "x-v0",
    label: "X · v0 / Vercel",
    note: "创作者或明确署名的转发帖，包含 v0 制作证据与网页结果。",
  },
  {
    id: "x-mixed",
    label: "X · 多工具",
    note: "多模型或多工具网页制作案例，需重点判断方法是否足够可复用。",
  },
];

export const WEB_CALIBRATION_SEEDS = [
  {
    id: "2026249809506811965",
    title: "Gemini 3.1 一次生成动效网站",
    sourceId: "x-mixed",
    model: "Gemini 3.1",
    methodSignal: true,
    notes: "原帖声明包含 Prompt，结果为完整动效网页。",
  },
  {
    id: "2024832167164133766",
    title: "AntiGravity + Gemini 3.1 落地页",
    sourceId: "x-mixed",
    model: "AntiGravity · Gemini 3.1 Pro",
    methodSignal: true,
    notes: "原帖声明公开 exact prompts，聚焦落地页设计。",
  },
  {
    id: "2042188738818957631",
    title: "Claude + Nano Banana + Kling 动画网站",
    sourceId: "x-claude",
    model: "Claude Code · Nano Banana Pro · Kling",
    methodSignal: true,
    notes: "多工具组合工作流；原帖声明 Prompt 在回复中。",
  },
  {
    id: "2036138516070146225",
    title: "Google Stitch 对比 Claude 网页生成",
    sourceId: "x-mixed",
    model: "Google Stitch · Claude",
    methodSignal: true,
    notes: "同一设计任务的工具对比，并声明给出 exact prompt。",
  },
  {
    id: "2033967195924144341",
    title: "Nano Banana + Veo 3 + Lovable 动效站",
    sourceId: "x-lovable",
    model: "Lovable · Nano Banana · Veo 3",
    methodSignal: true,
    notes: "从视觉素材到网页实现的多工具案例。",
  },
  {
    id: "2059294558299766837",
    title: "ChatGPT Image 设计转 React Native 网站",
    sourceId: "x-claude",
    model: "ChatGPT Image 2.0 · Claude Opus 4.6",
    methodSignal: true,
    notes: "先生成设计，再由 Claude 转为可运行网站；原帖声明给出 Prompt。",
  },
  {
    id: "1998052721493258363",
    title: "四模型 Lovable 网页 Prompt 对比",
    sourceId: "x-lovable",
    model: "Grok · Claude · GPT · Gemini · Lovable",
    methodSignal: true,
    notes: "同一网站任务的四模型 Prompt 与视频结果对比。",
  },
  {
    id: "2038564207101436210",
    title: "Gemini vs Claude：Velorah 电动房车落地页",
    sourceId: "x-claude",
    model: "Gemini · Claude",
    methodSignal: true,
    notes: "同一网页任务的模型对比；线程中包含完整复现 Prompt。",
  },
  {
    id: "2054291040379842795",
    title: "GPT Image 2 + Veo 3 + Lovable 营销站",
    sourceId: "x-lovable",
    model: "GPT Image 2 · Veo 3 · Lovable",
    methodSignal: true,
    notes: "从视觉生成到动效网页的完整组合；线程中包含完整 Prompt。",
  },
  {
    id: "2037902313910899150",
    title: "Nano Banana + Kling + Claude 电影感 Hero",
    sourceId: "x-claude",
    model: "Nano Banana · Kling · Claude",
    methodSignal: true,
    notes: "多工具网页 Hero 工作流；线程中包含可复制 Prompt。",
  },
  {
    id: "2077366050828751274",
    title: "Claude + Fable：Aethera Fintech 落地页",
    sourceId: "x-claude",
    model: "Claude · Fable",
    methodSignal: true,
    notes: "金融科技落地页；线程中包含完整复现 Prompt。",
  },
  {
    id: "2067218410350797295",
    title: "Grok Imagine + Grok Build：Veldara Hero",
    sourceId: "x-mixed",
    model: "Grok Imagine · Grok Build",
    methodSignal: true,
    notes: "从视觉到网页 Hero 的 Grok 工作流；线程中包含 Prompt。",
  },
  {
    id: "2027664654252839271",
    title: "Nano Banana + Flow + AntiGravity 动效网站",
    sourceId: "x-mixed",
    model: "Nano Banana · Flow · AntiGravity",
    methodSignal: true,
    notes: "多工具动效站制作；线程中包含可复制 Prompt。",
  },
  {
    id: "2040894867153338643",
    title: "Claude 自动生成单页动效站",
    sourceId: "x-claude",
    model: "Claude",
    methodSignal: true,
    notes: "单页动效网站案例；线程中包含完整 Prompt。",
  },
  {
    id: "2065418614627602509",
    title: "Claude Mythos：Lithos 地质品牌 Hero",
    sourceId: "x-claude",
    model: "Claude Mythos",
    methodSignal: true,
    notes: "地质品牌网页 Hero；线程中包含完整复现 Prompt。",
  },
  {
    id: "2072997540451258848",
    title: "Fable 与 Opus 同 Prompt 滚动页对比",
    sourceId: "x-claude",
    model: "Fable · Claude Opus",
    methodSignal: true,
    notes: "同一 Prompt 的滚动网页结果对比；线程中保留原 Prompt。",
  },
  {
    id: "2044721965215174664",
    title: "Kimi K2 网站 Creative Brief",
    sourceId: "x-mixed",
    model: "Kimi K2",
    methodSignal: true,
    notes: "完整 Prompt 架构直接写在主帖，包含审美、版式、动效与约束。",
  },
  {
    id: "2027889115166085484",
    title: "Gemini 3.1 暗色科技网站 Prompt",
    sourceId: "x-mixed",
    model: "Gemini 3.1 Pro",
    methodSignal: true,
    notes: "完整网站 Prompt 直接写在主帖，并附网页视频结果。",
  },
  {
    id: "2029971732443058437",
    title: "太空旅行全屏动画 Hero",
    sourceId: "x-mixed",
    model: "React · Vite · TypeScript",
    methodSignal: true,
    notes: "主帖包含 5,000+ 字符的完整实现 Prompt 与网页视频。",
  },
  {
    id: "2017239599391625501",
    title: "品牌策略师式网站结构 Prompt",
    sourceId: "x-mixed",
    model: "通用网页生成 Prompt",
    methodSignal: true,
    notes: "主帖直接给出品牌策略与转化导向的完整网站 Prompt。",
  },
];

export const WEB_V2_SEEDS = [
  {
    id: "2051754118302126256",
    title: "PEEKABOO 儿童应用落地页",
    sourceId: "x-mixed",
    model: "React · Vite · Tailwind CSS · Framer Motion",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖给出完整网站规格，并展示儿童应用落地页结果。",
  },
  {
    id: "2079488114192441838",
    title: "Qwen 3.8 全屏视频动效 Hero",
    sourceId: "x-mixed",
    model: "Qwen 3.8",
    methodSignal: true,
    notes: "线程包含完整 Prompt，结果为可交互的全屏视频 Hero。",
  },
  {
    id: "2046598954943697068",
    title: "Grok 4.3 奶油色电商网站",
    sourceId: "x-mixed",
    model: "Grok 4.3",
    methodSignal: true,
    notes: "主帖直接给出配色、组件、购物车与响应式要求。",
  },
  {
    id: "2080385837955502527",
    title: "Fable 5 复刻 3D 云基础设施网站",
    sourceId: "x-claude",
    model: "Fable 5",
    methodSignal: true,
    notes: "同作者线程包含 3D 城市、路线、日志与镜头交互的复刻 Prompt。",
  },
  {
    id: "2038213885451194583",
    title: "Claude Code 动画素材库落地页",
    sourceId: "x-claude",
    model: "Claude Code · Sonnet 4.6",
    methodSignal: true,
    notes: "主帖保留建站实验、完整 Prompt 与视频结果。",
  },
  {
    id: "2037871524573851880",
    title: "Perplexity Computer 自动生成 Startup 落地页",
    sourceId: "x-mixed",
    model: "Perplexity Computer",
    methodSignal: true,
    notes: "线程给出从 Startup 概念到完整落地页的一次性 Prompt。",
  },
  {
    id: "2075608862875623931",
    title: "Hunyuan 加密产品 3D 落地页",
    sourceId: "x-mixed",
    model: "Tencent Hunyuan",
    methodSignal: true,
    notes: "主帖包含产品定位、3D 元素、定价与响应式要求。",
  },
  {
    id: "2054168909452869842",
    title: "Claude + Codex + Gemini + OpenClaw 重建落地页",
    sourceId: "x-claude",
    model: "Claude Design · Codex · Gemini · OpenClaw",
    methodSignal: true,
    notes: "十步工作流包含每个工具的 Prompt、实现过程与视频结果。",
  },
  {
    id: "2028713799533109599",
    title: "Lumi 租房真实成本计算器",
    sourceId: "x-mixed",
    model: "Lumi",
    methodSignal: true,
    notes: "线程提供完整交互 Web App Prompt，覆盖输入、计算与结果展示。",
  },
  {
    id: "2012151254408175841",
    title: "Lovable 邮件签名生成器",
    sourceId: "x-lovable",
    model: "Lovable",
    methodSignal: true,
    notes: "主帖包含字段、实时预览、HTML 输出和复制行为要求。",
  },
  {
    id: "1987126547464265989",
    title: "Signal Drift AI 课程落地页",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    notes: "短但完整的 Prompt 指定目标、页面模块、视觉约束与移动端要求。",
  },
  {
    id: "1991491913963434204",
    title: "Genspark 咨询公司官网",
    sourceId: "x-mixed",
    model: "Genspark AI Developer",
    methodSignal: true,
    notes: "具体 Prompt 指定公司定位、服务、关于、评价和联系模块。",
  },
  {
    id: "2067978971741147543",
    title: "SynapseX 全屏 3D Hero",
    sourceId: "x-mixed",
    model: "Grok Imagine 1.5 · Grok Build",
    methodSignal: true,
    notes: "主帖含完整技术栈、滚动、3D 场景和交互 Prompt。",
  },
  {
    id: "2067215788654940307",
    title: "Neumorphism 个人作品集",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    notes: "主帖直接提供新拟态作品集的完整视觉和页面结构 Prompt。",
  },
  {
    id: "2064679099571089727",
    title: "Neo Brutalism 个人作品集",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    notes: "同作者第二条样本，完整描述粗野主义视觉、组件和交互。",
  },
  {
    id: "2080978137467265229",
    title: "Claude Opus 5：Dreamer AI 落地页",
    sourceId: "x-claude",
    model: "Claude Opus 5",
    methodSignal: true,
    notes: "短 Prompt 明确落地页类型、排版、动效、基准、定价与文档模块。",
  },
  {
    id: "2079523145749545243",
    title: "Qwen 3.8 WebGL 数字有机体网站",
    sourceId: "x-mixed",
    model: "Qwen 3.8 Max",
    methodSignal: true,
    notes: "主帖给出 WebGL、物理交互、空间排版和滚动叙事要求。",
  },
  {
    id: "2068317283173507498",
    title: "GPT-5.6 Robotics CAD 落地页",
    sourceId: "x-mixed",
    model: "GPT-5.6 Pro",
    methodSignal: true,
    promptScope: "main",
    notes: "具体 Prompt 描述工业 CAD 终端风格与 Three.js 机械结构。",
  },
  {
    id: "2079158303385628907",
    title: "Hunyuan AI SaaS 完整落地页",
    sourceId: "x-mixed",
    model: "Tencent Hunyuan Hy3",
    methodSignal: true,
    notes: "主帖包含暗色模式、定价、评价、FAQ、动效和响应式要求。",
  },
  {
    id: "2064368803006337114",
    title: "Claude 滚动叙事网站",
    sourceId: "x-claude",
    model: "Claude · Three.js · GSAP",
    methodSignal: true,
    notes: "三步 Prompt 覆盖章节滚动、指针响应纹理与 ScrollTrigger。",
  },
];

export const WEB_V3_SEEDS = [
  {
    id: "2006268255502205406",
    title: "Blackbox AI：学校管理平台落地页",
    sourceId: "x-mixed",
    model: "Blackbox AI · React · Tailwind CSS",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖给出学校管理平台定位、完整配色、布局与响应式 Prompt，并展示结果。",
  },
  {
    id: "2005913422790328779",
    title: "ClipFlow 视频电商 SaaS 落地页",
    sourceId: "x-mixed",
    model: "Next.js · Shadcn UI",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开完整 SaaS Prompt，覆盖品牌定位、页面模块、组件和视觉系统。",
  },
  {
    id: "2066868516104601790",
    title: "极简个人作品集与数字商店",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "完整 Prompt 描述黑白极简作品集、数字商品、导航和移动端体验。",
  },
  {
    id: "2062867179838767405",
    title: "Netflix 风格 3D 个人作品集",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "完整 Prompt 覆盖 Netflix 式视觉、3D 卡片、滚动、作品与联系模块。",
  },
  {
    id: "2022997925048250658",
    title: "Galaxyscale 数据库产品多页 Demo",
    sourceId: "x-mixed",
    model: "Clovr",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开短而具体的数据库产品、单色视觉、强调色和多页 Demo Prompt。",
  },
  {
    id: "2022944169665401053",
    title: "Zeroframe 数据智能平台多页站",
    sourceId: "x-mixed",
    model: "Clovr",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开产品受众、未来感单色风格、Logo 和浅色模式约束。",
  },
  {
    id: "2068317279620943955",
    title: "VEIL/FIELD 数字时装屋落地页",
    sourceId: "x-mixed",
    model: "GPT-5.6 Pro · Three.js",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖 Prompt 指定数字时装定位、Three.js 布料场景、编辑排版和指针交互。",
  },
  {
    id: "2068301911414149526",
    title: "Orbital North 太空旅行落地页",
    sourceId: "x-mixed",
    model: "GPT-5.6 Pro · Three.js",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖独立展示太空旅行网站与 Prompt；限定主帖，避免串入同线程其他作品。",
  },
  {
    id: "1770409664972239357",
    title: "Dora AI 复古蛋糕店网站",
    sourceId: "x-mixed",
    model: "Dora AI",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出蛋糕店、复古风、饱和色、动画与艺术风格约束并展示结果。",
  },
  {
    id: "1770409662405394767",
    title: "Dora AI 摄影师作品集",
    sourceId: "x-mixed",
    model: "Dora AI",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开摄影作品集、多重曝光、配色、影像与光线风格 Prompt。",
  },
  {
    id: "2070428537790877738",
    title: "Gemini + AntiGravity 牙科诊所网站",
    sourceId: "x-mixed",
    model: "Gemini · AntiGravity · React",
    methodSignal: true,
    notes: "同作者线程给出完整牙科诊所网站规格、动效、组件与响应式 Prompt。",
  },
  {
    id: "2018605321716166742",
    title: "Cryptie 加密资产管理落地页",
    sourceId: "x-claude",
    model: "Shipper · Claude Opus 4.5",
    methodSignal: true,
    notes: "线程 Prompt 覆盖产品、配色、排版、组件和科技感动画。",
  },
  {
    id: "2032918511610376509",
    title: "Kansei AI 营销机构官网",
    sourceId: "x-claude",
    model: "Claude Sonnet 4.5",
    methodSignal: true,
    notes: "线程给出营销机构业务、品牌调性、页面层级和动态展示要求。",
  },
  {
    id: "1978226719225004290",
    title: "Gemini 模拟理论交互网站",
    sourceId: "x-mixed",
    model: "Gemini 3 Pro",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖完整描述实时渲染、物理故障、线框和交互叙事效果。",
  },
  {
    id: "2026284847480918093",
    title: "Gemini Formula 1 动态数据面板",
    sourceId: "x-mixed",
    model: "Gemini 3.1 · React · Framer Motion",
    methodSignal: true,
    notes: "线程给出完整 F1 数据面板 Prompt，覆盖布局、赛道、遥测和动效。",
  },
  {
    id: "2079946571622326363",
    title: "Codex 中国古寺 3D 交互网站",
    sourceId: "x-mixed",
    model: "Codex · GPT-5.6 Ultra · Blender · Three.js",
    methodSignal: true,
    notes: "同一作品线程包含从参考图到 Blender 模型、材质、导出和 Three.js 查看器的完整任务。",
  },
  {
    id: "2018363609806696512",
    title: "MiniMax Gateflow CLI 产品站",
    sourceId: "x-mixed",
    model: "MiniMax 2.1",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开基于 GitHub 项目生成电影感产品站的完整 Prompt。",
  },
  {
    id: "1927257751480045778",
    title: "HeroUI 电影导演作品集",
    sourceId: "x-mixed",
    model: "HeroUI",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖给出电影导演作品集的背景影像、排版、片目、关于与联系模块。",
  },
  {
    id: "1796544545594773725",
    title: "AI 婚纱购物与虚拟试穿网站",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开婚纱目录、虚拟试穿、安全结账与顾问服务 Prompt。",
  },
  {
    id: "2008084668097446153",
    title: "Nano Banana 手绘线框转 SaaS 落地页",
    sourceId: "x-mixed",
    model: "Google Nano Banana · Next.js · Shadcn UI",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖包含从手绘线框到生产级 SaaS 页面的完整产品、组件和布局 Prompt。",
  },
  {
    id: "2053809664140226852",
    title: "Codex 四季与时区动态 Waitlist",
    sourceId: "x-mixed",
    model: "Codex · GPT Image 2.0",
    methodSignal: true,
    notes: "线程给出静态 HTML、四季昼夜素材、访客时区和过渡交互的完整 Prompt。",
  },
  {
    id: "2072583919036232079",
    title: "GTA VI 风格电影感游戏官网",
    sourceId: "x-mixed",
    model: "ChatGPT · AI Website Builder",
    methodSignal: true,
    notes: "同一作品线程包含视觉稿 Prompt 与最终动画网站结果。",
  },
  {
    id: "1882299724708880573",
    title: "Cursor 为工作室网站增加无后台博客",
    sourceId: "x-mixed",
    model: "Cursor · Next.js · shadcn/ui",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖给出博客列表、详情页、Markdown 内容与 SEO 工作流的完整实现 Prompt。",
  },
  {
    id: "1991146150859039013",
    title: "Gemini 企业级交互落地页",
    sourceId: "x-mixed",
    model: "Gemini 3 Pro",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖直接给出企业落地页、交互、动画与响应式要求并展示结果。",
  },
  {
    id: "2016052040804532499",
    title: "Kimi 多行星文明电影感网站",
    sourceId: "x-mixed",
    model: "Kimi K2.5 Agent",
    methodSignal: true,
    notes: "线程包含多行星主题、电影级场景、滚动与图片生成的完整长 Prompt。",
  },
  {
    id: "2062588457780965724",
    title: "MiniMax ZARA Cafe 电商网站",
    sourceId: "x-mixed",
    model: "MiniMax M3",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出咖啡品牌、电商定位、移动端、转化布局和体验要求。",
  },
  {
    id: "1949047175482167671",
    title: "Rocket 全球美食学习平台",
    sourceId: "x-mixed",
    model: "Rocket",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开多页美食教学、时间线、交互食谱、配色和视差 Prompt。",
  },
  {
    id: "1934585075242344853",
    title: "AI 摄影工作室预约网站",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开摄影工作室、画廊、定价、评价与预约表单 Prompt。",
  },
  {
    id: "2064631389895438705",
    title: "Step 3.7 Flash 智能手表发布页",
    sourceId: "x-mixed",
    model: "Step 3.7 Flash",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖保留原始产品 Prompt，并展示从一句产品定义生成的完整发布页。",
  },
  {
    id: "2007089835853451628",
    title: "Replit YouTube 转 SEO 博客应用",
    sourceId: "x-mixed",
    model: "Replit · Gemini 3",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开 URL 输入、字幕提取、Gemini 改写和 SEO 博客输出 Prompt。",
  },
  {
    id: "1938576094841778230",
    title: "Rocket 导师预约 Web App",
    sourceId: "x-mixed",
    model: "Rocket",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出导师预约、可用日历、课程类型和反馈表单 Prompt。",
  },
  {
    id: "1990889563636511017",
    title: "Gemini 高价值 Prompt Generator SaaS",
    sourceId: "x-mixed",
    model: "Gemini 3",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开前端、响应式、禁用 Tailwind 和代码预览约束。",
  },
  {
    id: "2048713881544233239",
    title: "Kimi 足球装备电商网站",
    sourceId: "x-mixed",
    model: "Kimi Agent",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出足球装备品牌、电影感街头视觉、深色主题、动效与后端要求。",
  },
  {
    id: "1947601505034625051",
    title: "Manus 健身业务预约官网",
    sourceId: "x-mixed",
    model: "Manus",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖完整描述健身业务 Hero、服务、评价、日程、博客与联系模块。",
  },
  {
    id: "1934885815353565528",
    title: "Rocket AI 心理健康日记应用",
    sourceId: "x-mixed",
    model: "Rocket",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出 AI 日记反馈、情绪图表、提醒和多屏应用要求。",
  },
  {
    id: "1934886860968624365",
    title: "Rocket H&M 风格快时尚电商站",
    sourceId: "x-mixed",
    model: "Rocket",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖完整描述季节专题、筛选、Shop the Look、趋势与博客模块。",
  },
  {
    id: "1936384755739877644",
    title: "Rocket 汽车租赁预订网站",
    sourceId: "x-mixed",
    model: "Rocket",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开车辆筛选、预订、支付、账户、搜索与移动端 Prompt。",
  },
  {
    id: "1921973855507382334",
    title: "Lovart AI 科技创业公司首页",
    sourceId: "x-mixed",
    model: "Lovart AI",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出科技创业公司、冷色、粗体排版、Hero 与 CTA Prompt。",
  },
  {
    id: "2047034246758637618",
    title: "ChatGPT Image 个人品牌网站视觉稿",
    sourceId: "x-mixed",
    model: "ChatGPT Image 2.0",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开基于个人资料生成高端个人网站视觉稿的 Prompt 与结果。",
  },
  {
    id: "1948428488081637597",
    title: "Mocha 教育者个人作品集",
    sourceId: "x-mixed",
    model: "Mocha",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开教育者作品集、响应式、联系表单、图库与 UX 要求。",
  },
];

export const WEB_V4_SEEDS = [
  {
    id: "2021520082661499387",
    title: "高端住宅翻新机构落地页",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开住宅翻新品牌定位、深色 Hero、版式、内容替换与视觉约束。",
  },
  {
    id: "2068957493561045032",
    title: "3D 超市包装式创意机构官网",
    sourceId: "x-claude",
    model: "Claude Fable 5 · Three.js · Blender · GSAP",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开以商品包装呈现服务的 Prompt，并说明 Three.js、Blender 与 GSAP 实现方法。",
  },
  {
    id: "2043011240046530732",
    title: "暗黑奢华太空主题 React 网站",
    sourceId: "x-mixed",
    model: "Gemini 3.1 Pro · Three.js · GSAP · Framer Motion",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开折射玻璃八面体、鼠标视差、点击旋转与动效技术栈 Prompt。",
  },
  {
    id: "2067578193910038890",
    title: "Claymorphism 3D 个人作品集",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开黏土拟态、暗色模式、3D 元素、立体阴影与作品集结构 Prompt。",
  },
  {
    id: "2045381925553201173",
    title: "浓缩咖啡订阅服务落地页",
    sourceId: "x-claude",
    model: "Claude Opus 4.7",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出一次生成单文件落地页的 exact prompt，并让模型自行决定排版、色彩和间距。",
  },
  {
    id: "2072142373698797716",
    title: "Claude Sonnet 个人内容网站",
    sourceId: "x-claude",
    model: "Claude Sonnet 5",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开一次生成个人介绍、项目展示与内容发布网站的短 Prompt。",
  },
  {
    id: "2044234253215395936",
    title: "本地持久化任务追踪 Web App",
    sourceId: "x-claude",
    model: "Claude Code",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开任务、截止日期、状态筛选、排序、暗色模式与本地存储 Prompt。",
  },
  {
    id: "2040296305679839279",
    title: "AI 编程去模板化 Skill 落地页",
    sourceId: "x-mixed",
    model: "AI Coding Agent",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开多区块 Skill 落地页 Prompt，强调留白、集成对象、审美与信息结构。",
  },
  {
    id: "2072378105117941854",
    title: "电影感 FIFA 世界杯网站",
    sourceId: "x-claude",
    model: "Claude Sonnet 5 · Cursor",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖保留首次生成 Prompt 与后续迭代说明，结果包含赛程、积分与沉浸动效。",
  },
  {
    id: "2038413163645841453",
    title: "Oren Studio 哥本哈根建筑事务所官网",
    sourceId: "x-mixed",
    model: "Leylo AI",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开品牌、项目、编辑摄影、自然色、留白与电影感字体 Prompt。",
  },
  {
    id: "2041070492434751644",
    title: "Git 分支对比设计页",
    sourceId: "x-mixed",
    model: "LLM Web Builder",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖展示将分支差异重排为长页面的 Prompt 与结果。",
  },
  {
    id: "2079835670156128295",
    title: "Canva 产品经理单页作品集",
    sourceId: "x-mixed",
    model: "Canva AI Code",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开产品经理单页作品集 Prompt，并展示 Canva AI Code 结果。",
  },
  {
    id: "1992661234261561686",
    title: "MCP360 暗色健身房官网",
    sourceId: "x-claude",
    model: "Claude · MCP360 ImageGen",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开生成暗色健身房网站与配图的一次性 Prompt。",
  },
  {
    id: "1908877453000339560",
    title: "背景移除 SaaS 落地页",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开背景移除工具 SaaS 网站 Prompt 与生成结果。",
  },
  {
    id: "1955346691323793822",
    title: "ONLYFROGS 创意网站完整工作流",
    sourceId: "x-mixed",
    model: "多工具工作流",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖记录从详细 Prompt、图片生成到网页制作的工具链与完整步骤。",
  },
  {
    id: "2006664848432673046",
    title: "GLM 4.7 时尚品牌网站迭代",
    sourceId: "x-mixed",
    model: "GLM 4.7",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开连续多轮 Prompt，并展示从初稿到视觉强化的网站结果。",
  },
  {
    id: "1991900001501610464",
    title: "Gemini 3 一次重做产品落地页",
    sourceId: "x-mixed",
    model: "Gemini 3",
    methodSignal: true,
    notes: "作者线程保留落地页重做 Prompt 与上线结果。",
  },
  {
    id: "2023208206265376972",
    title: "Kimi 食物热量分析网站",
    sourceId: "x-mixed",
    model: "Kimi K2.5",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开热量、蛋白质、脂肪与钠含量分析网站 Prompt。",
  },
  {
    id: "2019079758789726628",
    title: "模糊色块动画落地页",
    sourceId: "x-mixed",
    model: "Nullshot AI",
    methodSignal: true,
    notes: "作者线程公开落地页背景色块与动画 Prompt。",
  },
  {
    id: "2049174624366137642",
    title: "GLM 5.1 一次生成创意网站",
    sourceId: "x-mixed",
    model: "GLM 5.1 · OpenCode",
    methodSignal: true,
    notes: "作者线程公开完整 UX/UI 与前端实现 Prompt，并展示单次生成结果。",
  },
  {
    id: "1905607920286396640",
    title: "Lovable 创意机构 Hero",
    sourceId: "x-lovable",
    model: "Lovable",
    methodSignal: true,
    notes: "作者线程公开机构首页 Hero 的完整 Prompt 与成品。",
  },
  {
    id: "1939004821526454650",
    title: "Claude 单人 SaaS 全流程 Mega Prompt",
    sourceId: "x-claude",
    model: "Claude 4 Sonnet",
    methodSignal: true,
    notes: "作者线程公开覆盖产品策略、后端、UI、落地页与 GTM 的完整 Prompt。",
  },
  {
    id: "1959271356350009522",
    title: "Grok 单人 SaaS 全流程 Mega Prompt",
    sourceId: "x-mixed",
    model: "Grok 4",
    methodSignal: true,
    notes: "作者线程公开覆盖产品策略、后端、UI、落地页与 GTM 的完整 Prompt。",
  },
  {
    id: "2065992579502747850",
    title: "早期互联网风个人档案页",
    sourceId: "x-mixed",
    model: "ChatGPT Image 2",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开白色画布、粉色浏览器边框、黑白肖像与散落元数据的完整视觉 Prompt。",
  },
  {
    id: "2061334430103535727",
    title: "3D 发票打印机 SaaS 组件",
    sourceId: "x-mixed",
    model: "AI UI Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开 3D 发票机、打印交互、动效与 SaaS 视觉规范 Prompt。",
  },
  {
    id: "2065041466951712940",
    title: "极简 AI 顾问个人作品集",
    sourceId: "x-mixed",
    model: "AI Website Builder",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开黑白中性色、内容层级、项目、服务、评价与联系模块 Prompt。",
  },
  {
    id: "2075940477946249515",
    title: "东京软件机构落地页",
    sourceId: "x-mixed",
    model: "GPT-5.6 Sol · ShioriCode",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开东京软件机构落地页的一次生成 Prompt 与视频结果。",
  },
  {
    id: "2079690934787383657",
    title: "2026 冬奥运动员与赛事中心",
    sourceId: "x-mixed",
    model: "YOLO Studio",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开赛事中心任务，并列出运动员搜索、奖牌榜、筛选、响应式与部署结果。",
  },
  {
    id: "2075493786214690876",
    title: "会学习偏好的定价页面探索器",
    sourceId: "x-claude",
    model: "Claude Fable 5 · Shipper",
    methodSignal: true,
    notes: "作者线程公开生成多套定价页、记录偏好并持续迭代的完整 Prompt。",
  },
  {
    id: "2076363513803784208",
    title: "宠物食品电影感滚动网页",
    sourceId: "x-mixed",
    model: "Gemini AntiGravity",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开宠物食品网页的主 Prompt、视觉参考、动画调整与制作说明。",
  },
  {
    id: "1940130431254634504",
    title: "消除 AI 网站模板感的设计系统",
    sourceId: "x-mixed",
    model: "Lovable · Bolt · Replit",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开不改文案、只重做排版与布局的完整 UI/UX 系统 Prompt。",
  },
  {
    id: "2006855707442954260",
    title: "自学习落地页方案目录",
    sourceId: "x-claude",
    model: "Claude Code · V Computer",
    methodSignal: true,
    notes: "作者线程公开生成多套落地页、收集偏好并更新设计方向的完整 Prompt。",
  },
  {
    id: "1955960744622612758",
    title: "童话场景到沉浸式落地页工作流",
    sourceId: "x-mixed",
    model: "Midjourney · Rocket",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开从场景概念、图像 Prompt 到动效网页的完整工作流。",
  },
  {
    id: "1931440446125006916",
    title: "AI 解决方案市场平台",
    sourceId: "x-mixed",
    model: "Bolt",
    methodSignal: true,
    notes: "作者线程公开 8,000 字符级平台 Prompt，覆盖角色、市场、工具与业务流程。",
  },
  {
    id: "1787627585158938736",
    title: "黑金 Royalcore 室内设计网站视觉",
    sourceId: "x-mixed",
    model: "Midjourney · Leonardo · Magnific",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开网站视觉 Prompt、Style Reference 与动画结果。",
  },
  {
    id: "2003407421520191694",
    title: "GLM 4.7 多游戏中心",
    sourceId: "x-mixed",
    model: "GLM 4.7 · Next.js",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开包含俄罗斯方块、数独、宾果等游戏及排行榜的项目 Prompt。",
  },
  {
    id: "1993370841804161238",
    title: "Gemini 学习管理系统落地页",
    sourceId: "x-mixed",
    model: "Gemini 2.0 Flash Lite",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开导航、Hero、Bento 功能区、评价、页脚与移动端要求。",
  },
  {
    id: "1993070524058993025",
    title: "Claude Opus 高端定宽落地页",
    sourceId: "x-claude",
    model: "Claude Opus 4.5 · v0",
    methodSignal: true,
    promptScope: "main",
    notes: "主帖公开 1024px 定宽、高端排版、字体与视觉系统 Prompt。",
  },
  {
    id: "1992691747986850142",
    title: "Gemini 个人音乐清单社区",
    sourceId: "x-mixed",
    model: "Gemini 2.0 Flash Lite",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖公开注册、发布音乐清单、完整落地页与 CTA Prompt。",
  },
  {
    id: "2005292658827440633",
    title: "AntiGravity 一晚生成销售页",
    sourceId: "x-mixed",
    model: "Google AntiGravity",
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
    notes: "主帖给出销售页首轮 Prompt、规划模式与浏览器迭代步骤。",
  },
];

function uniqueMedia(tweet) {
  const rows = [
    ...(tweet?.entities?.media || []),
    ...(tweet?.extended_entities?.media || []),
  ];
  return [
    ...new Map(
      rows.map((media) => [
        media.media_key || media.id_str || media.media_url_https,
        media,
      ])
    ).values(),
  ];
}

export function extractBestMedia(tweet) {
  const media = uniqueMedia(tweet)[0];
  if (!media) {
    return { mediaKind: "image", mediaUrl: "", posterUrl: "" };
  }
  if (media.type === "video" || media.type === "animated_gif") {
    const videoUrl = (media.video_info?.variants || [])
      .filter((variant) => variant.content_type === "video/mp4")
      .sort((left, right) => (right.bitrate || 0) - (left.bitrate || 0))[0]
      ?.url;
    return {
      mediaKind: "video",
      mediaUrl: videoUrl || "",
      posterUrl: media.media_url_https || media.media_url || "",
    };
  }
  return {
    mediaKind: "image",
    mediaUrl: media.media_url_https || media.media_url || "",
    posterUrl: "",
  };
}

function decodeTweetText(value) {
  const decoded = String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
  return unescapeDoubleEncodedText(decoded);
}

/**
 * 修上游双重编码：多行推文正文被某个环节按 JSON 字符串二次序列化后，
 * 换行变成了字面量反斜杠 n，一路穿透到 cases.prompt_full，页面直接显示 \n
 * （2026-08-06 全库清出 6 条，5 条来自本管线的批次）。
 *
 * 不能无脑全局反转义：代码/YAML 类 prompt 可能合法包含 \n 字面量。
 * 判据是双重编码的特征——一段多行文本被压成单行后必然「有字面量换行、
 * 零真实换行」；两者混在一起的文本按原样放行，宁可漏修不误伤。
 */
export function unescapeDoubleEncodedText(value) {
  const text = String(value || "");
  const literalNewlines = (text.match(/\\n/g) || []).length;
  if (literalNewlines < 2 || text.includes("\n")) {
    return text;
  }
  return text
    .replaceAll("\\n", "\n")
    .replaceAll("\\t", "\t")
    .replaceAll('\\"', '"');
}

function promptMarkerIndex(value) {
  return value.search(
    /(?:website\s+)?prompt(?:\s+i\s+used|\s+used|\s+to\s+the\s+app\s+builder)?\s*:|exact prompt[^:]{0,80}:|use this prompt\s*:|typed one prompt[.:]?/i
  );
}

function promptScore(value) {
  const text = decodeTweetText(value).trim();
  let score = 0;
  if (promptMarkerIndex(text) >= 0) score += 7;
  if (
    /(?:full|exact|challenge|generated|recreation)\s+(?:\w+\s+){0,2}prompt/i.test(
      text.slice(0, 180)
    )
  ) {
    score += 7;
  }
  if (/\bprompt\b/i.test(text.slice(0, 120))) score += 3;
  if (/\b(build|create|design|develop|implement|recreate)\b/i.test(text)) score += 2;
  if (
    /\b(section|layout|background|typography|component|animation|responsive|interaction)\b/i.test(
      text
    )
  ) {
    score += 2;
  }
  if (text.length >= 500) score += 3;
  if (text.length >= 1500) score += 2;
  if (
    text.length < 500 &&
    /access all prompts|full course|source file|comment .+ i.ll dm|bookmark this/i.test(
      text
    )
  ) {
    score -= 4;
  }
  return score;
}

function isCompleteShortPrompt(value, options = {}) {
  const text = decodeTweetText(value).trim();
  if (text.length < 220 || text.length >= 500) return false;
  const markerIndex = promptMarkerIndex(text);
  if (markerIndex < 0) return false;
  const promptBody = text.slice(markerIndex);
  if (
    !options.allowDeclarative &&
    !/\b(build|create|design|rebuild|develop|implement|generate|make)\b/i.test(
      promptBody
    )
  ) {
    return false;
  }
  const specifics = promptBody.match(
    /\b(websites?|platform|portfolio|sections?|pages?|hero|services?|about|testimonials?|reviews?|contact|pricing|faq|layout|backgrounds?|typography|components?|animations?|responsive|mobile|interactions?|forms?|booking|calendar|gallery|dashboard|filters?|navigation|cta|palette|colors?|monochrome|logos?|retro|parallax|frontend|backend|tailwind|preview|e-?commerce|app|url|transcript|blog|infographic|journal|mood|feedback|three\.js|gsap|scroll|cursor)\b/gi
  );
  const minimumSpecifics = options.allowDeclarative ? 1 : 3;
  return (
    new Set((specifics || []).map((item) => item.toLowerCase())).size >=
    minimumSpecifics
  );
}

function collapseRepeatedPrompt(value) {
  const text = decodeTweetText(value)
    .replace(/https:\/\/t\.co\/\w+/g, "")
    .trim();
  const repeated = text.match(
    /\n+Here(?:'|’)?s the exact prompt[^\n]*\n+\s*PROMPT:\s*/i
  );
  if (!repeated || repeated.index == null || !/^PROMPT\s*:/i.test(text)) {
    return text;
  }
  const normalize = (part) =>
    part.toLowerCase().replace(/\s+/g, " ").trim();
  const firstBody = normalize(
    text.slice(text.indexOf(":") + 1, repeated.index)
  );
  const repeatedBody = normalize(
    text.slice(repeated.index + repeated[0].length)
  );
  if (
    firstBody.length >= 300 &&
    repeatedBody.startsWith(firstBody.slice(0, 300))
  ) {
    return text.slice(0, repeated.index).trim();
  }
  return text;
}

export function extractThreadPrompt(tweet, threadTweets = [], options = {}) {
  const username = (
    tweet?.user?.screen_name ||
    tweet?.user?.username ||
    ""
  ).toLowerCase();
  const thread = [
    tweet,
    ...threadTweets.filter((item) => item?.id_str !== tweet?.id_str),
  ];
  const candidates = thread
    .map((item, index) => ({
      item,
      index,
      isMain: item?.id_str === tweet?.id_str,
    }))
    .filter(({ item }) => {
      const itemUsername = (
        item?.user?.screen_name ||
        item?.user?.username ||
        ""
      ).toLowerCase();
      return username && itemUsername === username;
    })
    .map(({ item, index, isMain }) => ({
      text: decodeTweetText(item.full_text || item.text).trim(),
      index,
      isMain,
    }))
    .filter(({ text }) => Boolean(text))
    .map(({ text, index, isMain }) => ({
      text,
      index,
      isMain,
      score: promptScore(text),
    }))
    .filter(
      (item) =>
        item.score >= 7 &&
        (item.text.length >= 500 ||
          (item.isMain &&
            isCompleteShortPrompt(item.text, {
              allowDeclarative: Boolean(options.allowShortPrompt),
            })))
    )
    .sort((left, right) => left.index - right.index);

  return candidates
    .map(({ text }) => collapseRepeatedPrompt(text))
    .join("\n\n---\n\n");
}

export function extractPromptSourceUrl(threadTweets = []) {
  for (const tweet of threadTweets) {
    for (const url of tweet?.entities?.urls || []) {
      const expanded = url.expanded_url || "";
      if (/motionsites\.ai\/?\?prompt=/i.test(expanded)) {
        return expanded;
      }
    }
  }
  return "";
}

export function mapTweetToReviewItem(tweet, seed, threadTweets = []) {
  const username = tweet?.user?.screen_name || tweet?.user?.username || "";
  const creator = seed.creatorOverride || (username ? `@${username}` : "未知作者");
  const { mediaKind, mediaUrl, posterUrl } = extractBestMedia(tweet);
  const promptText = extractThreadPrompt(
    tweet,
    seed.promptScope === "main" ? [tweet] : threadTweets,
    { allowShortPrompt: seed.allowShortPrompt }
  );
  const promptSourceUrl = extractPromptSourceUrl(threadTweets);
  const checks = {
    source: Boolean(tweet?.id_str && username),
    author: creator !== "未知作者",
    result: Boolean(mediaUrl),
    method: Boolean(seed.methodSignal),
    prompt: Boolean(promptText),
    license: false,
  };
  const candidateType =
    checks.source &&
    checks.author &&
    checks.result &&
    (checks.method || checks.prompt)
      ? "case"
      : "topic_seed";
  const completeness =
    [checks.source, checks.author, checks.result, checks.prompt].filter(Boolean)
      .length / 4;
  const sourceDefinition = SOURCE_DEFINITIONS.find(
    (source) => source.id === seed.sourceId
  );

  return {
    id: `x-${tweet.id_str}`,
    sourceId: seed.sourceId,
    sourceLabel: sourceDefinition?.label || "X",
    sourceUrl: `https://x.com/${username}/status/${tweet.id_str}`,
    title: seed.title,
    creator,
    creatorUrl: username ? `https://x.com/${username}` : "",
    mediaUrl,
    posterUrl,
    mediaKind,
    promptText,
    promptSourceUrl,
    method: decodeTweetText(tweet.full_text || tweet.text),
    model: seed.model,
    license: "原帖可公开访问；转载与二次展示许可仍需复核",
    notes: [
      seed.notes,
      `互动快照：${Number(tweet.favorite_count || 0).toLocaleString()} 赞 · ${Number(
        tweet.bookmark_count || 0
      ).toLocaleString()} 收藏 · ${Number(tweet.views_count || 0).toLocaleString()} 浏览`,
      "GoodCase 尚未复跑。",
    ].join("\n"),
    metrics: {
      likes: tweet.favorite_count ?? null,
      comments: tweet.reply_count ?? null,
      reposts: tweet.retweet_count ?? null,
      bookmarks: tweet.bookmark_count ?? null,
      views: tweet.views_count ?? null,
    },
    checks,
    completeness,
    candidateType,
  };
}

export function buildWebCalibrationReport(
  tweets,
  generatedAt = new Date().toISOString(),
  threadsById = {},
  options = {}
) {
  const seeds = options.seeds || WEB_CALIBRATION_SEEDS;
  const byId = new Map(tweets.map((tweet) => [tweet.id_str, tweet]));
  const missing = seeds
    .filter((seed) => !byId.has(seed.id))
    .map((seed) => seed.id);
  if (missing.length) {
    throw new Error(`SocialData 缺少 ${missing.length} 条种子：${missing.join(", ")}`);
  }

  const items = seeds.map((seed) => {
    const threadTweets =
      threadsById instanceof Map
        ? threadsById.get(seed.id) || []
        : threadsById[seed.id] || [];
    return mapTweetToReviewItem(byId.get(seed.id), seed, threadTweets);
  });
  const sources = SOURCE_DEFINITIONS.map((source) => {
    const sourceItems = items.filter((item) => item.sourceId === source.id);
    return {
      ...source,
      collected: sourceItems.length,
      cases: sourceItems.filter((item) => item.candidateType === "case").length,
      topicSeeds: sourceItems.filter(
        (item) => item.candidateType === "topic_seed"
      ).length,
      error: "",
    };
  });

  return {
    runDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
    }).format(new Date(generatedAt)),
    generatedAt,
    title: options.title || "网页榜 V1 校准",
    stats: {
      total: items.length,
      cases: items.filter((item) => item.candidateType === "case").length,
      topicSeeds: items.filter((item) => item.candidateType === "topic_seed")
        .length,
    },
    sources,
    discoverySources: [
      {
        name: "MotionSites",
        role: "discovery_only",
        note: "用于发现 Prompt、风格和工具组合；不冒充案例作者。",
      },
      {
        name: "SocialData",
        role: "evidence_transport",
        note: "用于读取 X 原帖、媒体和互动快照；X 原帖才是来源。",
      },
    ],
    items,
  };
}
