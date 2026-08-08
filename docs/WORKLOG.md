# WORKLOG

> 追加式变更日志，最新的在最上面。每次代码或文档修改收尾时补一条。

## 2026-08-08 · 社交分享卡全站补齐（PR #52）

- socialMetadata() 统一出口，11 个页面接入 og/twitter 元数据；修掉两个线上
  已存在 bug：creator/skill 详情页因 metadata 浅合并丢 og:image、案例 og 卡
  中文字体子集漏「完整 Prompt 公开」渲染空白。
- 案例详情 og 卡左文右图合成（本地缩略图 data URI 内联，satori 零网络请求），
  竖图不再被裁成腰部横带；站点卡文案改用 messages.ts 既有 tagline。
- 视频案例微信降级抓图修复：case-media 视频分支垫同 slug 真实 img（video
  盖其上像素无差），微信分享不再抓到相关推荐里其他案例的图。
- 已知边界：微信站内完全自定义卡片需公众号 JS-SDK（上线后事项）；站点默认卡
  og:image URL 无内容哈希，改 tagline 后需去各平台 debugger 手动刷缓存。
- 验证：tsc / lint / npm test 414/414 / build 1106 页 / preview curl og 标签
  与 og 图路由抽查。

## 2026-08-08 · 复测生产保护 fail-closed（issue #44）+ apply-verdict 批量模式

- **fail-open → fail-closed**。旧 `assertSafeTarget` 依赖 `PROD_SUPABASE_URL` 存在，
  而这个值平时不在 `.env.local` 里（现状就是没配），守卫整条静默失效，复测一直在
  直写生产库；精确串比对还能被尾斜杠绕过。新增
  `scripts/retest/lib/write-target.mjs`，照 `scripts/ops/lib/supabase-smoke.mjs` 的
  `assertTestTarget` 口径用 project ref 比对，**`--expect-project` 必填**，
  认不出 / 没点名 / 点名不一致直接拒绝执行。
- 生产不堵死：复测写生产是既定事实，合法姿势改成显式
  `--expect-project=<生产 project ref>`。刻意不给 env 兜底（区别于只读的
  `test:supabase` 允许 `SUPABASE_TEST_PROJECT_REF`），否则默认值配一次就忘，
  一年后又变回守卫恒真。
- 同样的空门在 `run-retest.mjs` 的 `writeToDatabase`（原来零守卫），一并接同一道闸门；
  `--run` 才拦，`--plan` 只读不受影响，闸门放在调模型之前避免白烧一轮生成额度。
- **批量模式**：`--file=verdicts.json` 吃裸数组或 `retest-manifest.json` 原样
  （`records[]` 里人填的 `verdict` / `reviewerNotes` / `reviewer` 都认——这就是运营
  手上现成的文件，不用再转格式）。逐条写、逐条报成败，单条失败不打断整批，
  `verdict` 留空按跳过不按失败；收尾只在至少一条真改到已发布 Case 时触发**一次**
  Deploy Hook，`shouldTriggerRetestDeploy` 的 `updatedCaseCount` 语义随之变成整批计数。
  另加 `--dry-run`。单条模式除了多一个 `--expect-project` 之外行为不变（失败仍原样
  抛原始错误、退出码 1）。
- 顺手修掉 `shouldTriggerRetestDeploy` 里同一类的字符串比对（尾斜杠会把同一个库判成
  两个，静默吞掉该触发的部署），改成比 project ref，两边都认不出时才退回串比对。
- 验证：`npx tsc --noEmit`、`npm run lint`（0 error）、`npm test` 428/428；
  新增 `write-target.test.mjs`（没点名拒绝 / 点名不符拒绝 / 认不出拒绝 / 尾斜杠不再绕过 /
  点名生产放行）与 `verdict-batch.test.mjs`（全成功 / 部分失败 / 全失败 / 写成功但
  没改到 Case 时不触发部署 / manifest 解析）。CLI 侧实跑验证了拒绝路径与批量报告，
  全程只读，未写任何生产数据。

## 2026-08-08 · 文档残留的 Supabase 项目 ref 清理

- PR #38 已把代码与测试里的真实 Supabase 项目 ref 换成占位符，但
  docs/PROJECT_STATE.md（发现治理与复测闭环一节）和本文件 2026-08-06 的
  smoke 记录里各漏了一处，现改为占位描述。全仓 grep 确认无其他残留。
- 仅文档改动，不涉及代码、数据库或部署。

## 2026-08-08 · 边缘缓存调优上线（PR #49）+ 复测管线触发部署

- 八条从未被边缘缓存的路由补 generateStaticParams 静态化；首页等 revalidate
  3600→86400；/daily 保持 1h；三条 searchParams 列表页经 next.config 下发
  CDN-Cache-Control s-maxage=86400 + swr=604800（此前对 Vercel 是否尊重该头
  置信度 70%，preview 与生产均实测 MISS→HIT 证实有效）。
- apply-verdict 成功更新 Case 后自动触发 Deploy Hook（照抄发布链路模式，
  fail-soft，写测试库跳过）；不加则 dynamicParams=false 的详情页复测分数
  永远不上屏。经用户确认保留此无人值守部署路径。
- 生产验证：/changelog、/agent-api 翻 PRERENDER/HIT；/cases 带 CDN 头且
  二次请求 HIT；/operator 与 /api/* 保持原样未被波及；carlwow.com 同步生效。
- 已知跟进：apply-verdict 单条即触发一次构建，录入/复测量大后需批量模式
  （见 PR #49 描述）；复测生产保护空门问题见 issue #44。
- 验证：tsc / lint / npm test 414/414 / next build / preview + 生产 curl 清单。

## 2026-08-08 · goodcase.carlwow.com 上线 + 大陆可达性拨测

- **goodcase.carlwow.com 正式上线**：域名绑定到 Vercel goodcaseai 项目（先清掉了
  一条早期遗留的无效绑定），火山引擎 DNS 加 CNAME → cname.vercel-dns.com，
  证书自动签发，与主域同源同内容。定位是大陆备用入口；carlwow.com 的 DNS 托管
  在火山引擎，将来做分区解析（境内外不同入口）基础设施现成。
- **大陆可达性拨测（Globalping，大陆 8 探针 + 境外基线）**：goodcase.ai 与
  Blob 媒体域名均未被墙（8/8 返回 200），DNS 无污染；Blob 解析直达 AWS
  新加坡/东京，TTFB 130-380ms 表现良好。首页冷缓存 TTFB 大陆 1.8-2.1s、
  香港 1.1s、东京 0.3-0.6s——慢是全亚洲边缘缓存命中问题不是 GFW 问题；
  边缘缓存焐热后大陆 TTFB 降到 ~400ms。完整报告存主控本地
  （goodcase-china-accessibility-report-2026-08-08.md）。
- **结论对齐**：境内镜像从「待触发」降级为「观察项」；下一步优化方向是加长
  静态页 s-maxage + stale-while-revalidate 提高边缘命中率。
- 本条为文档更新，未改代码、数据库、生产数据或部署配置。

## 2026-08-07 · 修复 PR 审查指出的依赖、忽略规则、TLS 与分页问题

- 将 `pg` 从生产 `dependencies` 移到 `devDependencies`，并用 `npm install --package-lock-only --ignore-scripts --offline` 同步 lockfile；生产依赖审计不再把迁移 CLI 的驱动算入范围。
- 将 `.gitignore` 中三个本地交接文件规则锚定到仓库根目录，避免静默忽略 `docs/` 下的正式文档。
- `ops:migrate` 不再关闭证书验证：会移除连接串中可能覆盖显式 SSL 配置的参数，默认使用 `rejectUnauthorized: true`，并支持可选的 `DATABASE_SSL_CA` PEM 信任根。
- 两处 Supabase 分页页大小从 1000 降至 500；查询请求 `count: "exact"`，offset 按实际返回行数递进，服务端 max-rows 小于请求页大小时也不会跳过数据；新增两条边界回归测试。
- 将 smoke 测试中真实格式的 Supabase project ref 换成 `example-project` 占位值，并在 `.env.example` 说明可选 CA 配置。未改数据库、生产数据、部署配置或花费型供给 API。
- 验证：定向测试 11/11、完整 `npm test` 396/396、`npm run lint`、`npx tsc --noEmit`、`npm run build`（1124 static pages）、`npm audit --omit=dev`（0 vulnerabilities）与 `git diff --check` 全部通过。

## 2026-08-07 · 同步 upstream 至 236e8d7，合并冲突修复并入合并提交

- **同步范围**：`LearnPrompt/goodcaseai` 的 `upstream/main`（`236e8d7`）合入本仓库
  `main`，带入早报进顶部导航与「今日新复测」第二栏、Agent API key 签发脚本、
  retest manifest / source 读取、creator「最近作品」与 skill「最近例证」的作者侧
  时间、对应双语文案、feed 与 changelog，以及新增的纯逻辑测试。未改数据库、
  生产数据或部署配置。
- **冲突解决**：`skills/page.tsx` 保留本地的「按分类分组 + 搜索命中高亮」，同时接上
  远端新增的 `latestExampleDate`；`case-card` / `creator-card` 保留搜索字段与
  `splitHighlightedText`；卡片日期格式化统一到 `case-presentation`。
- **`formatCardPublishedDate` 钉死 `timeZone: "Asia/Shanghai"`**。构建机是 UTC，
  不钉时区时同一条案例在本地和线上会渲染出差一天的日期。`pickLatestAuthorDate`
  复用同一个 formatter，所以 creator / skill 的作者侧时间一并统一到北京时间。
  这是本仓库对远端代码的一处主动偏离，值得单独提回 upstream。
- **合并提交本身现在可编译**。第一版冲突解决丢了 `group.skills.map` 整层、函数体
  却仍引用 `skill`，`case-card` 的 import 也被吃掉，合并点 `tsc` 报 10 个
  `Cannot find name`，靠下一个提交才补回来——`git bisect` 与按提交构建都会在这里
  踩空。已把这批修复并入合并提交，合并点自身通过 lint / tsc / test / build。
- **WORKLOG 不再做历史压缩**。上一版把本文件从 428 行重写成 33 行摘要，连远端
  自己写的条目一起删掉了；这份日志是追加式的，且未来若向 upstream 提 PR，压缩会
  表现为删除对方的日志历史。已恢复完整历史，本条按规矩追加在顶部。
- **验证**：`npm run lint`、`npm test`（394/394）、`npx tsc --noEmit`、`npm run build`
  全部通过。未调用花费型供给 API，未碰数据库与生产数据。

## 2026-08-06 · 复审 PR #1/#2 后的五项修复

对已合入 main 的两个发现体验 PR 做了一次复审，修掉五个问题：

- **发布批次不再连坐**：`publish:cases` 命中重复由 `throw` 改为跳过。原写法在
  逐条写库的循环里抛错，前面的已发布、后面的一条不发，且每次重跑都卡在同一条。
  现在跳过、继续、末尾列清单并置 `exitCode=1`；被拦候选依然绝不入库。
- **重复检查不再会静默漏检**：读已发布 Case 改成 `range` 分页（页大小 1000）。
  PostgREST 默认 1000 行上限是静默截断的，案例过千后漏检且不报错。同时把
  `prompt_full` 收窄到本批候选涉及的分类（来源 URL 跨分类，仍取全量但只三个短
  字段），压 Egress。逻辑抽到 `published-content-index.mjs` 并补 3 个测试。
- **Skill 描述不再做无依据断言**：`deriveEvidenceSteps` 改成每个 Case 最多贡献
  一句。此前一个 Case 的 `resultBreakdown` 三段就填满全部方法步骤，「N 个 Case
  里反复出现」实际只有一个 Case 撑着。不足两个 Case 出证据就退回定义模板。
- **`/en` 不再中英混排**：en 下跳过含中日文的证据句（`resultBreakdown` 缺翻译时
  会回退中文原文），全跳过则退回英文模板；证据案例引号按语言切换。
- **`/cases` 恢复类型保护**：`src/lib/creator-diversity.mjs` → `.ts`。原 `.mjs`
  在 `allowJs` 下无声明，导入后 `caseItems` 退化成 `any[]`，整页失去检查而
  `tsc` 照样绿。测试改为直接导入 `.ts`，删掉中间的 re-export shim。
复审的复审又抓到两条，一并修掉：

- **resume 也要触发部署**：判断从 `inserted + updated` 改成
  `shouldTriggerDeploy(counters)`（含 `resumed`）。insert 成功但候选状态更新失败的
  那次会抛错退出、走不到部署这步；重跑走 resume 补齐数据却不触发 Deploy Hook，
  Case 于是停在「库里已发布、详情页 404」。补了恢复路径与全拦截两种情形的测试。
- **证据案例不再张冠李戴**：`deriveEvidenceSteps` 一并返回贡献证据的 Case，描述
  改用它们的标题。此前固定取 `cases.slice(0, 2)`，探针可复现「描述引 First/Second
  move、案例却列 No evidence / Evidence one」。en 下再滤掉标题没英文翻译的，
  滤空就省掉 `Examples:` 整段——只滤证据句挡不住标题那条混排路径。
- **Skill 反复出现的计数改按证据计**：匹配定义但没有证据句的 Case 不再被计入描述，
  中英文都明确写出有证据的 Case / 作者数量，避免「4 个 Case 反复出现」实际只有
  2 个 Case 出证据的过度断言。

- 验证：`npm test` 384/384、`npm run lint`、`npx tsc --noEmit`、`npm run build`
  全部通过；另用类型探针实测确认 `any[]` 退化已消除、证据案例与证据句已对齐。
  未碰数据库与生产数据。

## 2026-08-06 · 重复内容治理、复测 verdict 闭环与 Supabase smoke

- 发布链路新增可解释的重复拦截：规范化来源 URL 硬拦截，同分类同 Prompt 拦截，同一作者高相似 Prompt 拦截；同批候选也会互相检查。已有数据不做删除或自动合并。
- `/cases` 默认浏览加入创作者多样性，连续同作者最多 2 条；搜索结果不重排，保留已有相关度、命中片段和高亮。
- 新增 `scripts/retest/apply-verdict.mjs` 与稳定性纯逻辑模块。复测产物仍不自动判定，只有人工输入 verdict、notes、operator 并显式 `--yes` 后才会写测试库，并按最近一次有效人审结果同步稳定分；生产 URL fail closed。
- 新增 `scripts/ops/supabase-smoke.mjs`：必须显式指定 project ref，只读检查 `schema_migrations`、`cases`、`case_reactions`、`case_retests`。对用户测试项目（Supabase 项目 ref 不入库，见 PR #38 的占位符约定）实测通过：最新 migration `20260807010000_case_retests.sql`、306 cases、0 reactions、0 retests。
- 验证：`npm test` 376/376、`npm run lint`、`npx tsc --noEmit`、`npm run build`（1124 static pages）、Supabase smoke；ego-browser 本地验证默认案例浏览和 `q=香水` 搜索高亮/片段。

## 2026-08-06 · 搜索相关度、证据方法描述与 Skills 分类分组

- 搜索新增统一评分器：标题/作者/案例字段权重高于长 Prompt，多词查询要求完整命中；案例、Skill、Creator 列表按相关度排序，并以原有排序作为并列结果的次级顺序。
- 搜索结果卡片新增命中字段、短片段与关键词高亮；无查询时不传搜索字段，避免默认页面增加 RSC payload。
- Skill/Creator 搜索扩展到方法步骤、作者、代表案例、标签与 Prompt 证据；Skill 的描述和方法步骤从已存在的 `resultBreakdown` / `promptContributionNotes` 提取实际案例句子，保留定义模板作为无证据回退。
- `/skills` 在通用 Skill 与作者方法两层内部按 AI 视频、AI 编程(UI)、AI 图像、AI 文案、AI 硬件分组，固定顺序与现有筛选入口一致。
- 新增搜索与证据派生测试；本地验证：`npm test` 364/364、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过，build 生成 1124 个静态页面；ego-browser 本地验证 `/cases?q=character`、`/skills?q=character`、`/creators?q=AI`。

## 2026-08-06 · 补上 ops:migrate 的回滚闭环，回滚脚本首次被真正执行验证

- **发现**：规则要求每个 migration 配一份 rollback，`ops:migrate` 也校验 rollback
  文件存在——但工具只有 `--baseline` / `--apply` / 只读三种模式，**没有执行 rollback
  的命令**，所以那些 rollback 脚本从建仓起就没被跑过一次。没跑过的回滚是假的安全网
- **实测坐实了一个更严重的缺口**：在本机库手工跑两份 20260807 rollback（三张表当时
  都是 0 行），结构确实被删干净（三表 + `consume_api_quota` 全没），但
  `schema_migrations` **仍记着这两个已应用**。随后 `ops:migrate` 报 `pending: []`——
  记录说应用了、结构其实不存在，且 `--apply` 从此永远不会再跑它们。这与
  `--baseline` 建库那个坑是同一类，只是入口换成了回滚
- **修法**：`ops:migrate` 新增 `--rollback --file=<迁移文件名> --yes`，执行 rollback
  脚本后在同一条命令里删掉 `schema_migrations` 记录。约束三条：
  - 只允许退**最后一个已应用的迁移**（退中间那个会让后面的悬空，而记录仍说它们已应用）
  - 必须显式给 `--file=`，不提供「退最后一个」这种省事写法
  - 不加 `--yes` 只打印警告和对应 rollback 文件路径，不执行
- 删记录放在回滚提交**之后**，与 `applyMigration` 的顺序对称：这一步失败时结构已没、
  记录还在，重跑一次即可（rollback 是 `drop ... if exists` 幂等写法）；反过来先删记录，
  中途失败会留下「结构还在但记录没了」，下次 `--apply` 会重跑迁移
- 回滚目标选择抽成纯函数 `selectRollbackTarget`，node:test 覆盖 LIFO 约束与
  未指定 / 未知文件 / 未应用 / 缺 rollback 四条拒绝分支
- **真库端到端验证**：三条拒绝分支各拒一次；成功路径退掉 `20260807010000_case_retests`
  后表消失且状态重新变回 pending；`--apply` 恢复后 11 张表、`consume_api_quota`、
  RLS 全在，cases 306 行与回滚前逐条一致
- 测试 358 → 360

## 2026-08-06 · 撤掉 GitHub Pages 静态部署 + 对齐 upstream + 钉死 turbopack root

- 撤销本地 `Add GitHub Pages static snapshot deployment`，删 `.github/workflows/`、
  `scripts/build-github-pages.mjs`、`out/` 及三处文档提及。fork（ycl-2004）侧一并清理：
  main 强推回退、Pages 站点关闭、2 条 Actions 记录与 `github-pages` 环境删除、
  两个仓库 secrets 删除。全程无一次成功部署，Pages URL 从未上线
- 本地 main 快进到 upstream `6304b51`（6 个 commit，早报 / Agent API / 复测实验室）。
  重叠三文件手工合：`package.json` 保留双方全部命令（upstream 的 `daily:digest`、
  `api-keys`、新 test glob + 本地的 `ops:migrate`、`dev:seed`、`pg`、三条 `--env-file`），
  两份文档双方章节全留
- `next.config.ts` 补 `turbopack.root = import.meta.dirname`，解决主目录无关
  lockfile 导致 workspace root 被推断成 `~` 的问题
- **排查记录**：首次加该配置后 dev 报 `Can't resolve 'tailwindcss'` 与一串 React
  Client Manifest 错误，一度以为是配置写错。对照实验证明配置无辜——真因是 `.next`
  在「Ctrl-C 打断编译 + 随后混入 build 产物」后处于脏状态。`rm -rf .next` 后
  `import.meta.dirname` 与 `process.cwd()` 均正确解析到仓库根。**改 next.config
  后要清 `.next` 再验**
- 验证：lint 通过、测试 358/358、build exit 0（extra-lockfile 警告消失）、
  dev 下 `/`、`/agent-api`、`/daily` 均 200 且日志无报错

## 2026-08-06 · schema.sql 回补 20260807 两个 migration + 本机库补齐 case_reactions

- **发现**：upstream 加了 `20260807000000_agent_api_keys` 与 `20260807010000_case_retests`
  两个 migration 及对应 rollback，但没同步回补 `schema.sql`——`api_keys` / `api_usage` /
  `consume_api_quota` / `case_retests` 四个对象在 schema.sql 里一个都没有。这与
  2026-08-06 那次 08-05 漏补是同一个 bug：新库跑 schema.sql + `--baseline` 会把没执行过的
  migration 记成已应用，结构不存在且此后 `ops:migrate` 永不重跑
- **修法**：只回补 `schema.sql`，不新建 migration（迁移与 rollback 已齐备，且历史迁移
  不能动）。三张表连同全部 comment、check 约束、索引、RLS 与 revoke，以及
  `consume_api_quota` 函数（`security definer` + 三条 revoke）一并移植，保持幂等写法。
  依赖顺序 `api_keys` → `api_usage` → `consume_api_quota`
- **一致性验证**：把 schema.sql 新增段落与两个 migration 逐语句归一化比对（去注释、
  压空白、按 `$$` 感知切分），**32/32 条逐字对应**，零差异
- 本机库按 ONBOARDING 第 7 节流程：只读 `ops:migrate` 报 pending 2 且
  `missingRollbackFiles` 为空 → 核对 `DATABASE_URL` 的 project ref 与
  `NEXT_PUBLIC_SUPABASE_URL` 一致（确认不是生产）→ `--apply` 两个 migration 成功
- **顺带闭掉旧待办**：本机库缺 `case_reactions`（早先 baseline 记录与实际结构不符）。
  按 PROJECT_STATE 推荐做法重跑补全后的 schema.sql 全文，执行前先记录逐表行数做对照：
  cases 306 → 306、analytics_events 38 → 38、case_candidates 11 → 11，全表无一减少；
  `case_reactions` 建出、RLS 开、policy 数 0。`/api/reactions` 从 `available:false`
  转为 `available:true`，本地点赞与催复测投票恢复
- **生产未动**：两个 migration 尚未在生产执行，交付前须先备份
- 验证：lint 通过、测试 358/358、build exit 0

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
