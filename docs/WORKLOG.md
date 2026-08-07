# WORKLOG

> 追加式变更日志，最新的在最上面。每次代码或文档修改收尾时补一条。

## 2026-08-07 · Agent API 正式化：免 key 保底 + key 配额 + 溯源字段 + /agent-api 文档页

- `/api/public/cases` 与 `/api/public/cases/[slug]` 加准入判定。免 key 请求
  照常返回同样的数据，只是多了按 IP 60 次/小时的内存滑动窗口软限，
  Cache-Control 一字未改（仍是 public, s-maxage=300）；带 key 请求走
  日配额并回 `X-RateLimit-*`，Cache-Control 改成 private, no-store
  （逐请求变化的 Remaining 不能进 CDN，也不能把一把 key 的响应喂给另一把）
- **只有以 `gc_` 开头的凭据才算带 key 调用**。这条是向后兼容的关键：
  企业代理塞进来的无关 Authorization 头必须继续按匿名放行，不能 401。
  前缀对但形状不对（打错了 key）才 401，免得用户以为配额生效了
- 新增迁移 `20260807000000_agent_api_keys`（**未执行**）：`api_keys`（只存
  sha-256 hash）+ `api_usage`（按 key × UTC 日一行 upsert，不是逐请求明细）
  + `consume_api_quota` 函数。函数存在的唯一理由是把「查用量 → 判限额 →
  计数 +1」用行级锁做成原子操作；应用层 select-then-update 会因读改写竞态
  少算计数并放过超额请求
- 三张关系任一缺失时整体降级为免 key 模式（`isMissingApiKeyRelationError`，
  认 42P01 / 42883 / PGRST205 / PGRST202），所以代码可以先上线迁移后跑
- key 签发走 `scripts/api-keys/issue.mjs`（`npm run api-keys`，含 issue /
  revoke / list）。明文只在签发那一刻打印一次，库里、日志里都没有
- 公开响应新增 `provenance` 对象：sourceUrl + verifiedAgainstSource +
  method + policyEffectiveAt + note。2026-08-05 溯源审计的准入规则以前只活在
  运营流程里，机器读不到就等于没有。**没有 sourceUrl 时布尔为 false** ——
  无从对照就不做声明，这个字段的全部价值建立在它不虚报上
- 新增 `/agent-api` 文档页（zh/en），文案走页面自己的 `copy.ts` 局部字典，
  不进全站 messages.ts。响应示例是真实一次 curl 的输出，只截断了长字符串
- `llms.txt` 补 Agent API 入口、限额口径与 provenance 说明；sitemap 补
  `/agent-api`；`/api/public/*` 补 OPTIONS 预检（带 Authorization 的浏览器
  调用会先发 preflight，没有它前端根本连不上）
- 纯逻辑抽到 `src/lib/api-keys.ts` / `rate-limit.ts` / `provenance.ts`，
  node:test 覆盖哈希验证、限额边界、窗口滑动、降级判定、key 行判定四条
  401 分支（这四条只有迁移跑完才可能在线上走到，只能靠单测保证）
- 测试 334 → 335（新增三个测试文件共 22 个用例）

## 2026-08-07 · 作者侧时间上线（creator 最近作品 / skill 最近例证）

- 只加作者的时间不加编辑时间（编辑时间=给自己上公开时钟，批量运营会满屏
  「刚刚更新」、供给间歇满屏变旧；同理不做全站最后更新聚合）。绝对日期不用相对
- 纯派生零新查询：deriveCreatorsFromCases / deriveSkillCatalog 内取支撑案例
  最新 sourcePublishedAt（退 createdAt）。四处展示、中英、null 不渲染
- 事故记录：并行会话的 aa162fe 整批 add 时把本任务未提交的 messages.ts 卷进
  它的 commit——**共享工作区提交必须点名文件**这条铁律的又一实证；本轮提交
  已严格点名 11 个文件，另一会话的 scripts/retest/* 未触碰
- 测试 348 → 359（+11）

## 2026-08-06 · 截断补全收尾：管线双修 + 14 条方法论重写 + 站上更新日志追平

- `reviewed-web-video-20260728-v1` 批次 121 条全评：83 完整、32 截断已按原帖
  补全（最长 253→10640 字）、2 条原推无 prompt 已下架（累计下架 33）、
  2 条多段 prompt 待定夺、2 死案。SocialData 276 次调用
- 根因一（youmind 侧）：原推第 3000 字符处的硬截断，证据三层（我们全链路
  无长度上限、库内值与 youmind 现服务值逐字节相同、截断点对齐原推 2990–3028）。
  修法为检出告警不拦截（prompt-truncation.mjs，55 条标定命中 10 / 误报 0），
  完整原文可走补全流程追回
- 根因二（自家）：decodeTweetText 只解 HTML 实体不管字面量转义，多行正文
  双重编码后 \n 穿透入库（6 条已修）。补 unescapeDoubleEncodedText，判据
  「字面量换行 ≥2 且真换行为 0」，代码类 prompt 合法 \n 有测试锁死不误伤
- 旧 prompt <300 字的 17 条方法论全评：14 条与补全后的 prompt 矛盾已重写
  （中英），3 条无矛盾保留；en.resultBreakdown 5→19 条
- src/lib/changelog.ts（站上 /changelog 数据源，写死的数组）从 7-28 追平：
  新增 8-05/8-06 四条访客口径条目（提速上线、溯源治理、无账号互动、
  自托管媒体），中英同步。**注意：这个文件每次发版要手动补，别再忘**
- 测试 291 → 301

## 2026-08-06 · 真机反馈修复轮：投票全站可点、语言切换状态机缺陷、移动端三处（PR #30/#31）

- **提示语语言切换点了没反应（所有端）**：偏好状态机把语言压成
  original/localized 二值，表达不了「中文界面看英文译文」——点 en → 存
  localized → 同步事件把 localized 解析回 fallback（中文界面无中文译文时
  是 original），状态当场被打回。常见组合（英文原文配中文译文）恰好
  fallback 是 zh 所以长期未暴露，本批中文原文 + 仅英文译文的新案例一上
  即露馅。偏好改存具体语言，旧二值按 fallback 兼容
- **投票催复测铺到全部出现处**：抽 use-retest-vote 共用 hook（缝合
  local-retest-votes 已投状态 + reaction-counts 全局单例计数），卡片稳定度
  格子变可点按钮（虚线下划线 + hover 变橙的最小暗示；已投显示已催复测；
  preventDefault/stopPropagation 不触发卡片链接）。列表页仍只有一条批量
  计数请求；同一行卡片 y 对齐逐像素未变
- **触屏图片永久灰**：灰度回彩设计靠 hover，触屏没有 hover。裸 grayscale
  全部改 [@media(hover:hover)]:grayscale，触屏一开始就是彩色，hover 才
  消失的暗色渐变遮罩同样条件化；桌面行为一字不变
- **Skill 页安装命令把手机页面横向撑到约 900px**：CSS Grid 经典陷阱——
  移动端外层 section 无显式列定义，隐式轨道按 max-content 撑开且 grid item
  默认 min-width:auto，代码块自身的 overflow-x 救不了外层。全链路 min-w-0，
  与 /connect 既有防御一致；顶栏导航格加 shrink-0 grow-0 basis-auto 防拉伸
  （用户截图的拉伸未能复现，防御性加固）
- **原帖 ♥ N 样式对齐**：从 gc-chip 小药丸改为与点赞/收藏同规格盒子
  （min-h-11、1px 边框），刻意不用 gc-action 类避免悬停反色误导为可点
- 生产验收：375 视口英文切换往返成功、/cases 一页 18 个可点投票按钮、
  chip 44px、Skill 页 scrollWidth===clientWidth。测试 301/301

## 2026-08-07 · 早报 / Agent API / 复测实验室三线并发落地

- **每日早报**：/daily（1 新爆款 + 1 复习旧款，按日期确定性选择、可回放）、
  /daily/feed.xml（14 期重放）、scripts/daily/build-digest.mjs 出公众号 markdown。
  revalidate=3600（对齐自然日的滞后上限 1 小时）；期数自站点公开首日 05-17 起算。
  票数未进 ISR 数据层，复习位暂按稳定分排（页面与脚本同函数保证同对）
- **Agent API 正式化**：免 key 照常（软限 60/h/IP，goodcase skill 四条 curl
  原样重放验证 38 字段零变化）；gc_ 前缀 key + sha-256 hash 入库 +
  consume_api_quota 原子日配额；响应新增 provenance 字段；/agent-api 文档页；
  scripts/api-keys/issue.mjs 手动签发。迁移 20260807000000_agent_api_keys
- **复测实验室 v1**：codex 内置 image_generation（无模型选择权，记为
  codex-builtin-image-generation）+ gpt-5.6-sol 出单文件 HTML 截图。
  首批 image 5 + web 5 全部产出证据，报告落 ~/Downloads，产物上 Blob
  （+10.5MB，总 577MB）。脚本永不写 verdict、永不碰 stability_score。
  排队按催复测票（当前仅 5 票/2 条，实际靠热度）。迁移 20260807010000_case_retests
- 已知留白：goodcase skill 待出引用 provenance 的新版（要重新打包）；
  /connect 与 /agent-api 口径待收敛；10 条 media_url 站内相对路径未迁 Blob
  （复测下载器已兜底）；需要输入图的复测（3 条）缺原始输入素材
- 测试 301 → 349；两份迁移待主控在 Supabase 执行

## 2026-08-06 · 截断收尾：补全 32 条、方法论重写 14 条、两个上游损坏源堵死

- 全批次扫 `reviewed-web-video-20260728-v1` 121 条：补全 32 条截断 prompt
  （最大 253→10640 字，来源为作者跟帖/长推正文），2 条原推无 prompt 下架
  （累计 31 条），2 条死案。SocialData 276 次调用
- 根因一（意外发现）：约 2950 字硬墙**在 youmind 入库环节**，砍在原推第
  3000 字符——我们全链路无长度上限、库内值与 youmind 现服务值逐字节相同。
  修法为检出告警（prompt-truncation.mjs，55 条标定命中 10/误报 0）不拦截
- 根因二：多行正文被上游双重 JSON 编码，字面量 \n 穿透入库（6 条已清）。
  decodeTweetText 补 unescapeDoubleEncodedText，判据「字面量换行 ≥2 且真实
  换行为 0」，代码类 prompt 合法 \n 有测试锁死不误伤
- 17 条旧 prompt<300 字的方法论全评：14 条与补全后的完整 prompt 矛盾
  （「信息量偏简短」类断言判反）重写，3 条无矛盾保留；en resultBreakdown
  5→19 条真内容
- 两条多段 prompt 案例按拍板「合成不拆」：Vex 城市逃脱（2/3+3/3 两段连续
  动作戏，2515 字）、Viper 对战兽人（分镜编排表 + 多段视频 prompt 两阶段
  工作流，约 30k 字），保留作者段落标题、宣传衔接语剔除
- 测试 291 → 301；生产逐条验收（段落标记全在、宣传语已清、过时方法论归零）
- SocialData `conversation_id:` 检索存在静默漏检（6/105 硬零），作者时间线
  兜底可救，遗留为已知坑

## 2026-08-06 · 媒体全量迁移自有 Blob（500 个，零失败）

- 新建 Vercel Blob store `goodcase-media`（Public，iad1）。外链媒体 500 个
  （视频 207、封面 210、图片 83）全部镜像并翻库：youmind CDN 194、twimg 75+209、
  comfy 8、liblib 5、github 6、xiaoyaoyou 3。站点播放与第三方 CDN 可达性解耦
- 视频统一 720p h264 crf26 + `-movflags +faststart`（moov 前置；未 faststart 的
  mp4 在弱网下拿不到元数据，就是详情页 `--:--` 播不动的根因之一）；39 条转码
  反而更大的传原片。1382MB → 566.7MB，占 Hobby Blob 1GB 额度 55%
- 每条先上传并 HEAD 验证 200 与 content-type 才 PATCH 翻库；manifest
  `scripts/media/blob-migration-manifest.json` 保留全部原始 URL（回退/溯源）；
  逐行快照 `tmp/blob-migration-backup/`；脚本 `migrate-media-to-blob.mjs`
  支持 --dry-run 与断点续跑，dry-run 与实跑共用同一条 prepareUpload 路径
- 生产抽验三条（原 youmind/twimg/comfy 源）：全部 blob 源、readyState=4、play() 成功
- 遗留：未发布候选 29 条媒体仍挂 youmind；Blob 流量 10GB/月是下一个天花板，
  到量升 Pro 或按 manifest 重跑脚本挪 R2；BLOB_READ_WRITE_TOKEN 进过聊天记录
  **需在 Vercel 后台轮换**

## 2026-08-06 · 卡片等高、稳定度票数、视频加载兜底（PR #24）

- 卡片「一高一低」根因：外框与底栏其实等高，中段提示语块跟着标题行数/摘要
  长短/SKILL 行有无浮动。照 youmind 把每个分区高度锁死：标题 clamp 两行且
  一行也占两行位、摘要占满 clamp 高度、chips 单行不换行、SKILL 行永远占位
  （此前「不占位」的推理被用户眼睛否决）。验收线：同一行任意卡片提示语块/
  统计行/底栏 y 逐张相同，/cases、/models gallery、/creators 三种页面实测通过
- 稳定度格子接真实票数：`CaseCardStabilityVote` 订阅 reaction-counts 全局单例，
  票数 >0 显示「投票催复测 · N」，整页仍只有一条批量计数请求
- 视频三层兜底：source error（capture 监听，不冒泡到 video）、15 秒
  readyState===0 超时、兜底 UI（提示 + 重试 + 去原帖观看 ↗）。中英双语

## 2026-08-05 · 无账号点赞/催复测投票 + 原帖心数 + 公开 API 真计数（PR #22/#23）

- 站内互动从 localStorage 假数字改为真计数：`case_reactions` 一张表管
  like/retest_vote 两种 kind，唯一索引 (case_slug, session_id, kind) 防重；
  RLS 开且零 policy + revoke 表级权限，读写只走 `/api/reactions`（60s 边缘缓存，
  POST/DELETE 幂等）。防重身份是 localStorage 持久 `goodcase:reactor-id`，
  与埋点 sessionStorage 会话口径刻意分开
- 优雅降级：表未建时接口回 `available:false` 前端藏计数，代码可先上线迁移后
  自动激活。降级判定认 PGRST205（supabase-js 实际报的码）而不只是 42703
- 踩掉两坑：线上有中文 slug（ASCII 校验会打挂列表页批量请求，改 Unicode 类别
  校验）；reaction-counts 被 Turbopack 复制进 4 个 chunk 导致模块级去重失效，
  改 globalThis 单例
- 详情页点赞旁并排展示「原帖 ♥ N」（source_like_count 快照，267/304 条有值，
  明确署名不混入站内计数——冷启动不靠造假解决）；公开 API likedCount 接真数
  并新增 retestVoteCount，覆盖只做在公开 route 层
- migration `20260805200000_case_reactions` 已在生产执行；激活态六项验收
  （防重/幂等/撤销/越权 401/计数/清场）全过

## 2026-08-05 · 溯源审计与三道闸：全库 223 条零悬案，29 条编造下架

- 发现 youmind image 类 prompt 约 45% 是拿产出图逆向重构的（youmind 自标
  `#reversed-N` 锚点），`isBasedOn` 照样指向原推——「出处真、prompt 编」。
  判别力：带锚点已核对 6/6 对不上，不带锚点 30/30 一致。而锚点曾被
  `stripSourceFragment()` 在入库时抹掉（url.hash=""），全库残留 0
- 全库反查 223 条 youmind 案例（SocialData 补齐被折叠/受限原推）：
  195+1 干净、29 编造（分四批全部下架，备份于 tmp/unpublish-cases/，
  `unpublish-cases.mjs --restore` 可翻回）、2 改写（已换回作者中文原文重发，
  原英文版转为译文）、1 原推已删无法核实
- 三道闸进管线：`splitSourceReference()` 保留锚点存 provenance_anchor；
  带 reversed 锚点禁止自动进 pending（shadow-run + ingest 双层拦截，落
  *-provenance-blocked.json 逐条 warn）；入库窗口命中率比对原帖正文
  （`prompt-provenance.mjs`，40 字窗口命中率 <0.5 拦下，24 样本零漏报零误报；
  否决了「前 60 字符+引导词」方案：被 {argument} 参数化一票否决）
- migration `20260805100000_candidate_provenance_anchor` 已在生产执行，
  库级 CHECK 实测拒写（给 pending 候选写 reversed-1 返回 400）
- 另发现截断问题：`reviewed-web-video-20260728-v1` 批次约 58% 的 prompt
  只抓了主推开头、完整版在回复串（约 70 条），影响「可复现」，待批次级补全

## 2026-08-05 · 供给追新与积压清零

- youmind 三个分类页新录 11 条（batch `youmind-2026-08-05`），逐条打开原推
  人工核对（两条 youmind 展示的 prompt 与原推对不上，直接排除未入库）；
  适配器分类判定改以抓取入口页为准（applicationCategory 描述的是所用模型
  不是产出物，对方改枚举值即整片失效），/prompts/webpage 不再误判 image
- ComfyUI 4 条加工发布（双语 + 三段式方法论），发布严格按 batch 圈定；
  发布时媒体校验第一次实战拦截（poster_url 缺失），从 comfy.org og:image
  补齐而非绕过校验
- 76 条历史 pending 清零：拒 68（60 条开发期占位数据、8 条测试/空投稿），
  留 8（4 条 ComfyUI 已发布、2 条 youmind 无锚点待加工、2 条待人工）
- web 类 10 条静态图案例查原推，4 条原帖实为录屏，升级为视频
  （最高码率 mp4 + 官方封面）；全库 511 媒体 URL 探活死链为零
- `real-case-11-servasyy-ai` 补真实摘要与三段式方法论（全库最后一条模板
  兜底清零）；其创意归属有公开争议，详情页摘要末尾加中性说明（列表卡片
  因行数裁切不显示）

## 2026-08-05 · 承压改造上生产（PR #20/#21），Supabase 出网降一个量级

- 三列改版、模型页、i18n 整条线合入 main（45 commits / 404 文件），生产站
  从旧版直接切换：/cases 4578KB→178KB、/creators 1104KB→97KB、
  /models/[slug] 从 404 到 145KB
- 取数分三档（index 全表瘦列 / card 渲染行 / detail 单行）：冷渲染出网
  783KB → 详情页 0、首页 65KB、列表页 185KB。详情页构建期全量预渲染 +
  dynamicParams=false：运行期零 Supabase、真 404（流式渲染下 200 软 404
  救不回来，补 slug 列表也一样）；新发布 Case 需一次部署，Deploy Hook
  两环境已配好并接进发布/下架链路，全自动闭环已多次实战
- 读 searchParams 的三个列表页无法 SSG，改在取数层加 unstable_cache 跨请求
  缓存（缓存原始行不缓存 enrich 对象——后者 en 档已占单条 2MB 上限六成）；
  /cases 连续 10 次请求出网 5.01MB→0.50MB。发布链路补 revalidateTag
- 卡片 props 收窄（toCaseCardItem/toCreatorCardItem，必须放普通模块——挂
  "use client" 文件上 tsc/build 全过、运行期才炸）；卡片提示语按 360px 实测
  截断（中 44/英 75 字）；/creators、/models/[slug] 接分页
- 媒体按比例自适应：16:9 框 + 纸色底，偏离容差内 cover 否则 contain；
  容差按分类分档（web 0.10，video/image 0.25——阈值只对 web 类起作用，
  该类中位偏离 13% 恰在阈值间，且 UI 截图最不该裁）。manifest 记宽高
- migration `20260805000000_goodcase_prompt_preview_columns`（译文预览
  生成列）已在生产执行：列表档出网 1.12MB → 0.61MB
- 404 边界改客户端取语言修好全站详情页 500（not-found 读 headers 把整条
  路由拖成动态）；运营发布路径补上媒体校验（tsc 挡下的正是这个洞）

## 2026-08-04 · 晚间前端修复与 404 治理（47d8a61 / 0ecda5e / 0381d31）

- 首页深度 Case 客户端翻页（24 池 6/屏）、§02 悬停回原色、卡片对齐、
  推荐理由兜底；SocialData 修复两条视频案例的 media_url
- Supabase 故障时详情页抛 CaseDataUnavailableError 走错误边界，不再把临时
  故障固化成缓存 404；发布前媒体一致性校验入库（8 测试）

## 2026-08-04 · Seedance 2.5 模型上线 + 三条案例入库

- `src/lib/models.ts` 新增 `seedance-2-5` 家族并置顶打 `new`；`seedance-2` 的
  别名收紧成 `seedance 2.0 / seedance-2.0 / seedance2.0`。旧别名 `seedance`
  用 `includes` 匹配，会把 `seedance-2.5` 也算进 2.0，新增家族后一条 Case
  会同时出现在两个模型页
- 收录 3 条 Seedance 2.5 视频 Case（TechHalla 时间冻结倒放、Sharon Riley
  双人 K-pop MV、Strength04_X mini DV 咖啡 vlog），Prompt 与视频均取自原推文，
  经 SocialData 取指标与 mp4 直链；已 approved，等代码部署后再 publish
- 修 `scripts/ingest-candidates.mjs`：`mapCandidate()` 漏了 `translations` 和
  `translation_status` 两列，离线加工好的双语内容走 import:candidates 会被
  静默丢掉，发出去的 Case 永远没有译文
- 修 `scripts/review-candidates.mjs`：approve 时 select 的列里没有 `media_url`，
  而 `validateReview` 拿它判断有没有真实媒体，读回来永远是 undefined，
  CLI 审核路径实际上批不过任何候选（此前审核都走运营后台，所以没暴露）
- 遗留：`src/app/[lang]/operator/actions.ts:407` 调 `decidePublish()` 没传
  `candidate`，`npx tsc --noEmit` 报错，且今天新加的媒体一致性闸门在运营后台
  发布路径上等于没生效。改动前就存在，本次未动

## 2026-08-04 · migration 落地 + 额度警报记录

- `20260804000000_candidate_content_locale_optional` 由主控在 Supabase SQL Editor
  执行；代码侧插入测试行行为验证通过（content_locale 落 null），测试行已清理
- 记录 Supabase Egress 超限宽限期（至 2026-09-01），详见 PROJECT_STATE 额度警报节
- 远端 fix/supply-locale-detection-20260803、fix/image-quota-20260803 已删
  （均已完整并入 staging）

## 2026-08-04 · 语言判定修复全链路收口

- 合并 `fix/supply-locale-detection-20260803`（3 commits）与
  `fix/image-quota-20260803` 进 staging（d7074e8），零冲突，195 测试全绿
- 对生产库执行 `recalibrate-candidate-locale.mjs --apply`：未发布候选 182 条中
  87 条 zh-CN→en，0 失败，复跑归零；备份 `tmp/locale-recalibration/candidates-before-b688c688.json`
- 新建 docs/PROJECT_STATE.md 与本文件（AGENTS.md 引用的 ../docs/ 此前不存在）
- 遗留：migration 20260804000000 待在 Supabase 生产库执行；87 条 en 候选的
  zh-CN 翻译已委托 Codex

## 2026-08-04 · 供给管线语言判定修复（fix/supply-locale-detection-20260803）

- 根因：case_candidates.content_locale 库默认值 zh-CN，六个写入口全都不写
  该字段，「来自中文创作者」被当成「Prompt 是中文」；前端对英文 Prompt 二次
  机翻，译文相似度 >90%，语言切换失效（初代用户吐槽点）
- 判定逻辑抽为 `scripts/review/lib/content-locale.mjs` 唯一来源；
  recalibrate-content-locale.mjs 原样再导出，签名不变
- 修复写入口：publish-candidate、ingest-candidates、shadow-run、
  source-candidate-mapper、网页提交接口（界面语言≠内容语言）、sync-feishu-cases
- 新增发布哨兵、运营后台语言告警、recalibrate-candidate-locale.mjs 存量修复
  脚本（默认 dry-run，--apply 先备份）
- 新增 migration：case_candidates.content_locale 去 default 去 not null，
  空值表示尚未判定；cases 保持 not null
- 测试 172 → 195

## 2026-08-03 · 存量语言重算（staging e17136f 附带）

- `recalibrate-content-locale.mjs --apply`：已发布 311 条 zh-CN 中 272 条
  实为英文，重标并丢弃与原文高度重复的 promptFull 译文；
  备份 `tmp/locale-recalibration/`
