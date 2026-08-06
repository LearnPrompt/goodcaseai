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
- Agent API 状态：`/api/public/*` 免 key 匿名可用不变（新增按 IP 60 次/小时
  内存软限）；带 `gc_` 开头的 key 走日配额，key 由运营手动签发
  （`npm run api-keys`）。迁移 `20260807000000_agent_api_keys` **尚未执行**，
  当前所有请求都走降级后的免 key 路径；文档页 `/agent-api`
- 部署状态：goodcase.ai 与 test.goodcase.ai 代码/数据完全一致（staging 持续
  合入 main）；详情页构建期全量预渲染 + dynamicParams=false，发布/下架必须
  触发部署（Deploy Hook 两环境已配好并接入发布链路）；goodcase.carlwow.com
  尚未解析或上线
- 媒体状态：全部案例媒体已迁自有 Vercel Blob（goodcase-media，566.7MB/1GB），
  原始 URL 存 scripts/media/blob-migration-manifest.json；流量额度 10GB/月，
  到量升 Pro 或按 manifest 重跑脚本挪 R2
- 溯源状态：youmind #reversed 锚点三道闸在管线（适配器保留锚点、双层拦截、
  入库窗口命中率比对）；已发布 youmind 案例 223 条全部核对，29 条编造已下架

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
  已在本机库 `--apply`。生产尚未执行，交付 Carl 前须先备份。
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
