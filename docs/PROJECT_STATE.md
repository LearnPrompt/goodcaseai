# PROJECT_STATE

> 共享真相源。开始任何开发前先读这里，再看 [WORKLOG.md](./WORKLOG.md) 的最新几条。
> 完成修改后先更新本文件，再向 WORKLOG 追加记录。

## 项目口径

- 正式品牌名：GoodCase.ai
- 项目阶段：统一版已部署到生产；运营闭环与中文域名迁移继续收敛
- 一级内容对象：Case；Creator、Lab、Skill 只作为派生视图
- 认证状态：本月明确不建设账号体系；完整 Prompt 公开
- 互动状态：点赞与催复测投票为无账号真计数（case_reactions 表，浏览器持久
  匿名身份防重，读写只走 /api/reactions）；投票在全站所有出现处可点，
  跨页面状态一致；收藏仍为 localStorage
- 移动端口径：灰度回彩只在 hover:hover 设备生效，触屏直接彩色；
  提示语语言偏好按具体语言存储（original/zh/en，按界面语言分桶）
- 审核状态：候选通过 review:candidates 人工决策，再由 publish:cases 发布
- 搜索状态：`q` 搜索带中英同义词扩展（models.ts 模型家族别名组 +
  search.ts 补充表：千问/通义→qwen、可灵→kling、智谱→glm、海螺→minimax、
  豆包→doubao、即梦→seedance 等），整词相等才扩展、不做模糊联想；
  服务 aimap.carlwow.com 节点面板按中文实体名跳转 /cases?q= 的导流
- Agent API 状态：`/api/public/*` 免 key 匿名可用不变（新增按 IP 60 次/小时
  内存软限）；带 `gc_` 开头的 key 走日配额，key 由运营手动签发
  （`npm run api-keys`）。迁移 `20260807000000_agent_api_keys` **尚未执行**，
  当前所有请求都走降级后的免 key 路径；文档页 `/agent-api`
- 部署状态：goodcase.ai 与 test.goodcase.ai 代码/数据完全一致（staging 持续
  合入 main）；详情页构建期全量预渲染 + dynamicParams=false，发布/下架必须
  触发部署（Deploy Hook 两环境已配好并接入发布链路）；goodcase.carlwow.com
  已于 2026-08-08 上线（Vercel 绑定 + 火山引擎 DNS CNAME → cname.vercel-dns.com，
  与主域同源同内容），定位是大陆备用入口，.com 后缀保留将来备案可能性；
  2026-08-08 大陆拨测（Globalping 8 探针）两域名均 8/8 可达、DNS 无污染，
  热缓存 TTFB 中位数 ~400ms、冷缓存可达 2s
- 边缘缓存口径（2026-08-08，PR #49）：changelog/connect/agent-api/favorites/
  submit/feed.xml/llms.txt 已静态化；首页、/models、creator/skill 详情
  revalidate=86400，/daily 保持 1h；/cases、/skills、/creators 列表页走
  CDN-Cache-Control s-maxage=86400 + swr=604800（生产已验证边缘 HIT）；
  复测 apply-verdict 成功更新 Case 后自动触发 Deploy Hook（fail-soft），
  批量录入/复测量大后需加批量模式避免 N 次构建
- 媒体状态：全部案例媒体已迁自有 Vercel Blob（goodcase-media，566.7MB/1GB），
  原始 URL 存 scripts/media/blob-migration-manifest.json；流量额度 10GB/月，
  到量升 Pro 或按 manifest 重跑脚本挪 R2
- 溯源状态：youmind #reversed 锚点三道闸在管线（适配器保留锚点、双层拦截、
  入库窗口命中率比对）；已发布 youmind 案例 223 条全部核对，29 条编造已下架

## upstream 同步 · 2026-08-07

- 已将 `LearnPrompt/goodcaseai` 的 `upstream/main`（`236e8d7`）合入本仓库 `main`；合并冲突逐处取双方并集，未改数据库、生产数据或部署配置。
- 新增早报/复测联动：顶部导航接入 `/daily`，新增「今日新复测」槽位；早报构建与页面可读取复测 manifest，缺少可见案例时仍回退原复习逻辑。
- Creator 与 Skill 派生卡片/详情页新增支撑案例的最近来源日期；案例卡片统一复用日期格式化逻辑，缺日期时不渲染占位。
- `formatCardPublishedDate` 钉死 `timeZone: "Asia/Shanghai"`，构建机 UTC 与本地不再渲染出差一天的日期；`pickLatestAuthorDate` 复用同一 formatter。这是本仓库对远端代码的主动偏离，待单独提回 upstream。
- 新增复测来源与案例展示纯逻辑测试，并同步作者日期相关页面、双语文案、RSS/feed 与 changelog。
- 合并提交自身可编译：冲突解决的兼容修复已并入合并提交，不再出现「合并点 tsc 报错、靠下一个提交补」的红点历史。
- `docs/WORKLOG.md` 保持追加式全量历史，不做压缩归档——这份日志含远端条目，压缩在回推 upstream 时等同于删除对方历史。
- 本次仅同步代码与文档，未改数据库、生产数据或部署配置；验证为 `npm run lint`、`npm test`（394/394）、`npx tsc --noEmit` 与 `npm run build`（1124 static pages）全部通过。

## PR 审查修复 · 2026-08-07

- `pg` 只用于 `scripts/ops/migrate.mjs`，已从生产 `dependencies` 移到 `devDependencies`，`package-lock.json` 的根依赖分类与传递依赖标记同步；`npm audit --omit=dev` 已验证为 0。
- 根目录本地交接文件的 `.gitignore` 规则已加 `/` 锚点，不会再误伤 `docs/` 下同名正式文档。
- `ops:migrate` 现在剥离连接串中会覆盖 SSL 配置的参数，默认启用 `rejectUnauthorized: true`；需要自定义信任根时可通过 `DATABASE_SSL_CA` 提供 PEM 内容。
- `published-content-index` 与 `dev-seed` 分页页大小降为 500，并请求 exact count、按服务端实际返回行数推进 offset；即使 max-rows 小于请求页大小也不会跳过记录，新增回归测试覆盖该边界。
- Supabase smoke 测试改用 `example-project` 占位 project ref；本次未改数据库、生产数据或部署配置。

## 发现体验修复 · 2026-08-06

- 搜索统一使用字段权重与多词查询：标题、作者、案例摘要优先于长 Prompt，结果仍可从来源、模型、标签和 Prompt 证据召回；有查询时按相关度排序，用户选择的热度/稳定度/最新作为次级排序。
- 案例、Skill、Creator 卡片在搜索命中时显示命中字段、短片段与关键词高亮；无查询时不注入搜索字段，保持默认卡片 payload 精简。
- Skill 与 Creator 的搜索覆盖方法、作者、代表案例和 Prompt 证据；Skill 描述与方法步骤优先从已有 `resultBreakdown` / `promptContributionNotes` 提取，缺证据时才回退到定义模板。
- `/skills` 保留通用 Skill / 作者方法两层，并在每层内按 AI 视频、AI 编程(UI)、AI 图像、AI 文案、AI 硬件的固定顺序分组；没有可安装 Skill 的分类不渲染空组，但筛选入口保留。
- 本次仅修改本地代码与测试，未改数据库、生产数据或生产站点；本地验证为 364/364 tests、lint、TypeScript 和 production build 全部通过。

## 发现治理与复测闭环 · 2026-08-06

- 发布前重复治理已接入 `publish:cases`：同一规范化来源 URL 直接拦截；同分类完全相同的 Prompt 拦截；同一作者的高相似 Prompt 拦截。重复检查是 fail-closed 的发布闸门，不删除已有 Case，也不自动合并内容。
- 默认 `/cases` 浏览加入创作者多样性：同一作者最多连续出现 2 条；带搜索词时完全保留相关度排序，不做展示层重排。
- 复测仍由 `scripts/retest/run-retest.mjs` 只产出证据；新增 `npm run retest:verdict -- --id=... --verdict=... --notes=... --operator=... --yes`，人工确认后才写 `case_retests`，再用最近一次有效 verdict 同步 `cases.stability_score` 与 `evidence_level=L2`。`inconclusive` 不会清空已有稳定分，生产目标会被脚本拒绝。
- 新增 `npm run test:supabase -- --expect-project=<project-ref>` 只读烟测，验证 migration、cases、reactions、retests 表与关键字段；本次已在生产项目验证通过，未执行任何写操作。
- 本次只修改本地代码/文档与测试，未改 Supabase schema、未写生产数据；验证为 376/376 tests、lint、TypeScript、production build、Supabase smoke 与本地浏览器验收全部通过。

## 发现治理复审后续修复 · 2026-08-06

- `publish:cases` 命中重复不再 `throw` 中断整批。发布是逐条写库的，一 throw 会让
  后面的候选全部发不出去，而且每次重跑都卡在同一条。现在改成跳过该条、继续发其余、
  末尾列出被拦清单，并把 `process.exitCode` 设成 1。闸门仍是 fail-closed：**被拦
  的候选绝不入库**，只是不再连坐。
- 重复治理读已发布 Case 改为分页（`fetchAllRows`，页大小 1000）。此前是单次全量
  查询，PostgREST 默认 1000 行上限会**静默截断**，案例涨过 1000 条后重复检查开始
  漏检且不报错。同时把 `prompt_full` 从全量拉取收窄到「本批候选涉及的分类」——
  来源 URL 是跨分类硬重复所以仍取全量，但只带三个短字段。Egress 宽限期内这条要紧。
  逻辑抽到 `scripts/review/lib/published-content-index.mjs`，带分页与分类过滤测试。
- Skill 的「反复出现」不再是无依据断言。`deriveEvidenceSteps` 改成**每个 Case 最多
  贡献一句**：此前一个 Case 的 `resultBreakdown` 三段就能填满全部三个方法步骤，
  描述里「N 个 Case 里反复出现」实际只有一个 Case 撑着。现在凑不满两个不同 Case
  就整体退回定义模板。
- `/en` 目录不再中英混排。`resultBreakdown` 缺英文翻译时会回退中文原文，直接拼进
  英文描述会得到 `repeatedly show this move: 三步……`。现在 en 下跳过含中日文的证据
  句，全被跳过就退回英文定义模板；证据案例的引号也按语言切换（`“”` / `「」`）。
- `src/lib/creator-diversity.mjs` 改成 `.ts`。`allowJs: true` 且没有 `.d.ts`，
  从 `page.tsx` 导入它会让 `caseItems` 整个退化成 `any[]`，`/cases` 主列表页的
  类型保护全部失效而 `tsc --noEmit` 照样通过——假绿。测试改为直接导入 `.ts`
  （与 `skills.test.mjs` 等既有测试一致），中间那个 re-export shim 删掉。
- **resume 路径现在也触发部署**。判断抽成 `shouldTriggerDeploy(counters)`，`resumed`
  计入。此前是 `inserted + updated`：insert 成功但候选状态更新失败的那次会抛错退出、
  走不到部署这步，重跑走 resume 补齐数据却不触发 Deploy Hook，于是 Case 在库里
  `is_published=true`、详情页因 `dynamicParams=false` 一直 404。下架后重新发布同理。
- **Skill 的「证据案例」只列真正贡献了证据句的 Case**。`deriveEvidenceSteps` 一并
  返回 `evidenceCases`；此前描述固定取 `cases.slice(0, 2)`，排在前面但一句证据都没出的
  Case 会被冒名顶上，句子和案例对不上。en 下再滤掉标题含中日文的（title 缺翻译会
  回退中文原文），一条都不剩就整段省掉 `Examples:`，描述本身仍然成立。
- Skill 描述中的「反复出现」计数现在只统计真正贡献证据句的 Case 和作者，不把仅因
  标题/标签命中定义、但没有证据句的匹配 Case 算进去。
- 顺带校准口径：创作者多样性是「尽量」不是「保证」。剩余候选全是同一作者时会退回
  原顺序继续排（否则只能丢条目），所以列表尾部仍可能出现长于 2 条的同作者连排。
- 本次只改本地代码与测试，未碰数据库、生产数据或生产站点；验证为 384/384 tests、
  lint、TypeScript 与 production build 全部通过。

## 语言判定（content_locale）现状 · 2026-08-04

- 判定逻辑唯一来源：`scripts/review/lib/content-locale.mjs`（中日文字符占比 > 15%
  判中文，标点空白不计分母；口径已在 314 条真实数据上验证，勿随意调阈值）
- 全部六个写入口均按 Prompt 正文显式判定：ingest、shadow-run、
  source-candidate-mapper、publish（脚本与运营后台共用）、网页提交接口、飞书同步
- 存量已修：已发布 272 条（2026-08-03）、未发布候选 87 条（2026-08-04），
  备份均在 `tmp/locale-recalibration/`
- 发布闸门（publish-approved-cases）带语言不匹配哨兵告警；运营后台按正文
  显示原文语言并对标错候选给橙色提示
- migration `20260804000000_candidate_content_locale_optional` 已于 2026-08-04
  在生产库执行并行为验证（不写该字段时落 null，不再被默认值填成 zh-CN）
- 87 条改标 en 的候选缺 zh-CN 翻译，已委托 Codex 处理；发布闸门要求
  translation_status=confirmed，不会漏到线上

## 分支状态 · 2026-08-04

- staging 已聚齐 2026-08-03 ~ 08-04 全部改动（含 locale 修复与 image-quota），
  测试 195 项全绿；staging → main 的合并与生产部署由主控统一决策

## Seedance 2.5 上线 · 2026-08-04

- 模型注册表新增 `seedance-2-5`（badge `new`，置顶到首页模型条第一位），
  首页硬上限仍是 6 个，Grok Imagine 因此挤到 /models 全量页
- `seedance-2` 的别名从 `["seedance"]` 收紧成三种 2.0 显式写法：旧别名会把
  `seedance-2.5` 的数据一并吃掉，两个模型页互相串案例。线上数据里 seedance
  只有 `Seedance 2.0`（108 条）和 `seedance-2.5` 两种写法，收紧后 2.0 仍是 108
- 三条 Seedance 2.5 Case 已 approved 待发布，batch `seedance-25-20260804`，
  原始数据存档在 `scripts/review/data/seedance-25-cases-2026-08-04.json`
- **发布顺序有讲究**：必须先部署代码再跑 `publish:cases`。反过来的话，线上
  旧别名会先把这三条算进 Seedance 2.0，首页也不会出现 2.5 的格子

## 额度警报 · 2026-08-04

- Supabase Free Plan 上个账期 Egress 超限，宽限期到 2026-09-01。08-05 承压
  改造后：详情页运行期零 Supabase、列表页取数 0.61MB + 跨请求缓存窗口内
  稳态零回源，主要泄漏源已掐断；9 月前回 Usage 页确认曲线回落
- Vercel Blob（Hobby）：存储 566.7MB/1GB、流量 10GB/月、写操作 500/2000·月。
  流量是下一个天花板，播放量上来后需升级或迁 R2
- BLOB_READ_WRITE_TOKEN 曾进聊天记录，待在 Vercel 后台轮换（公开读不受影响）

## Agent API 正式化 · 2026-08-07（代码就绪，迁移未跑）

- 定位：Agent 生成图 / 视频 / UI 之前来查经过核验的 prompt，是机器流量这条
  第二增长曲线的计费入口。免 key 继续开放是硬约束——已发布的 goodcase Skill
  用裸 curl 调用，不能被弄坏
- 两档配额：免 key 按 IP 60 次/小时（进程内滑动窗口，Serverless 下是**软限**，
  实际放行量 = 60 × 活跃实例数）；带 key 默认 2000 次/UTC 天，计数落
  `api_usage`，由 `consume_api_quota` 行级锁做原子的判额 + 计数
- key 只存 sha-256 hash，明文只在签发那一刻打印一次。签发 / 吊销 / 列表走
  `scripts/api-keys/issue.mjs`（`npm run api-keys`），v1 不做自助注册
- **认定规则**：只有以 `gc_` 开头的凭据才被当作 API key。请求里出现无关的
  Authorization 头（企业代理常见）继续按匿名放行，不会 401
- 降级：`api_keys` / `api_usage` / `consume_api_quota` 任一缺失时整体退回免 key
  模式，所以代码可以先上线、迁移后跑。**代价是迁移前伪造的 key 也会被当匿名
  请求放行**，这是刻意选择——向后兼容优先于迁移窗口期内的防伪
- 响应新增 `provenance` 对象（sourceUrl + verifiedAgainstSource + method +
  policyEffectiveAt + note）。没有 sourceUrl 的案例 verifiedAgainstSource 为
  false，不做无依据的核验声明
- 迁移文件 `supabase/migrations/20260807000000_agent_api_keys.sql` 与回滚
  `supabase/rollbacks/20260807000000_agent_api_keys.rollback.sql` 已写好但
  **未在任何环境执行**。跑之前无须回退应用；跑完之后签发第一把 key 才算闭环

## 本地全栈开发工具 · 2026-08-06

- `next.config.ts` 的 CSP 仅在 `NODE_ENV=development` 放行 `unsafe-eval`，用于 React
  开发模式调试调用栈；生产 CSP 保持不放行。
- `next.config.ts` 显式设 `turbopack.root = import.meta.dirname`。Turbopack 靠向上找
  lockfile 推断 workspace root，开发机主目录若有无关的 `~/package-lock.json` 会把 root
  推断成主目录（模块解析范围放大，报错路径变成 `./Desktop/...`）。钉死后与开发机其它
  目录无关，`npm run build` 的 extra-lockfile 警告一并消失。
- 已补 `npm run ops:migrate`：默认只读状态；`--baseline` 只登记当前
  `supabase/migrations/` 的文件名与 SHA-256；`--apply` 才执行未登记 migration，
  已应用文件 checksum 改变会直接拒绝。数据库记录表为 `public.schema_migrations`，
  baseline 运行时创建并限制 anon/authenticated 权限。
- 已补 `npm run dev:seed`：生产使用 `PROD_SUPABASE_URL` + `PROD_SUPABASE_ANON_KEY`
  只读已发布 `cases`，本地使用 `NEXT_PUBLIC_SUPABASE_URL` + service role 分批按
  slug upsert；`--dry-run` 不写库，同 host 直接拒绝，生成列和生产候选外键不复制。
- 两个最新 migration 已补对应 rollback 文件，migration/rollback 文件名现在一一对应。
- 本机 `.env.local` 已配置自己的 Supabase 项目与 `DATABASE_URL`；`PROD_*` 只读值也已配置。
- `schema.sql` 已回补 `20260807` 两个 migration（`api_keys` / `api_usage` /
  `consume_api_quota` / `case_retests`），与 migrations 目录逐语句一致；两个 migration
  已在本机库 `--apply`。**生产尚未执行**，交付 Carl 前须先备份。
- `ops:migrate` 补 `--rollback --file=<迁移> --yes`：执行 rollback 脚本并**同步删除**
  `schema_migrations` 记录。只允许退最后一个已应用的迁移；不加 `--yes` 只警告不执行。
  此前只能手工跑 rollback 脚本，会留下「记录说已应用、结构其实没有」的状态。
- 本机库已完整验证 apply → rollback → 再 apply 往返，结构一致、306 条 cases 无损。
- 当前使用可解析的 Session pooler host `aws-0-ca-central-1.pooler.supabase.com:5432`；
  已在自己的 Supabase 库成功写入 `schema_migrations`，7 个现有 migration 全部登记，
  status 显示 pending=0。此前认证失败的根因是终端旧的 `DATABASE_URL` 覆盖了 `.env.local`；
  运行前需 `unset DATABASE_URL`，或在新终端执行。

## GitHub 入库安全审计 · 2026-08-06

- `LearnPrompt/goodcaseai` 的本地 `HEAD` 与 GitHub `main` 同为
  `684f5950a4cf4ed3dfcae00d301bace75874f8d1`；该提交的 Vercel status 为 success，
  GitHub Actions workflow runs 为空（仓库当前没有可用的 Actions CI）。
- `ONBOARDING-FULLSTACK.md` 与 `goodcase-dev-env-readonly.example.txt` 已整理成不含
  实值的交接文档，但**按决定不进版本控制**，与含真实值的
  `goodcase-dev-env-readonly.txt` 一并由 `.gitignore` 排除，只在本机流转。
- `.env.local` 含 service-role key、数据库连接串、运营密码和会话密钥，均未进入
  Git 追踪；仓库已追踪文件扫描未发现这类实值。`NEXT_PUBLIC_*` anon 值虽属公开运行时
  配置，也不把真实环境文件当作交接物提交。
- 入库前验证：`npm run lint`、`npx tsc --noEmit`、`npm test`（310/310）和
  `npm run build` 均通过。build 仅有上层目录存在额外 lockfile 的 workspace root 警告，
  不影响本次验证。

## schema.sql 漏了两个 migration（已修文件，本地库待同步）· 2026-08-06

**症状**：新建库按 ONBOARDING-FULLSTACK 第 2 节「跑一次 schema.sql + `--baseline`」建成后，
`ops:migrate` 报 pending=0，但库里既没有 `case_candidates.provenance_anchor` 列，
也没有 `case_reactions` 表。

**根因**：`schema.sql` 只同步到 `20260805000000`，后加的
`20260805100000_candidate_provenance_anchor` 与 `20260805200000_case_reactions`
没有回补进去。`--baseline` 只写记录不执行 SQL，于是把这两个从未在新库执行过的
migration 也登记成已应用——记录说应用了，结构其实不存在，且 `ops:migrate`
此后永远不会再跑它们。这违反了「新库跑 schema.sql 一个就够」这条性质。

**实际影响**：`/api/reactions` 优雅降级返回 `{"available":false}`，点赞与催复测
投票在这类库上静默失效，不报错所以极难发现；`import:candidates` 探测到
`provenance_anchor` 列不存在会跳过该字段写入（溯源标记仍进 tags，不影响拦截）。
生产库是逐条 `--apply` 上去的，不受影响；只影响照文档新建的开发库。

**已修**：`schema.sql` 已补齐这两个 migration 的全部 DDL（列 + comment + 约束
+ 索引 + 建表 + RLS + revoke），保持幂等写法。

**已闭环（2026-08-06）**：本机库已重跑补全后的 `schema.sql` 全文，`case_reactions`
建出，306 条 cases 与其余各表行数逐表核对无一丢失，`/api/reactions` 从
`available:false` 转为 `available:true`。做法确认为重跑 schema.sql（幂等）而不是删
`schema_migrations` 记录再 `--apply`。其它按旧文档 baseline 建成的开发库同样处理。
