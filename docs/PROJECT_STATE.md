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

## 本地运维工具链 · 2026-08-07

- 迁移唯一入口是 `npm run ops:migrate`：不带参数完全只读（报待应用与缺 rollback）；
  `--baseline` 只登记文件名与 sha256，不执行 SQL；`--apply` 执行未登记迁移；
  `--rollback --file=<迁移> --yes` 跑 rollback 脚本并同步删除 `schema_migrations`
  记录。**不要手工跑 rollback 脚本**——只删结构不删记录，会留下「记录说已应用、
  结构其实没有」且 `--apply` 永不重跑的状态。回滚只允许退最后一个已应用的迁移。
- 迁移记录表 `public.schema_migrations` 存 sha256，改写已应用过的迁移会被拒绝。
  历史迁移不要动，要改就新增一个。
- `npm run dev:seed` 从生产只读拉已发布 cases 到本地库；`--dry-run` 不写库，
  源库与目标库同 host 直接拒绝，生成列与生产候选外键不复制。
- `npm run test:supabase -- --expect-project=<project-ref>` 是只读烟测，
  必须显式指定 project ref 才会连库。
- `supabase/schema.sql` 保持最新全量状态，「新库跑它一个就够」是必须维持的性质；
  `supabase/migrations/` 与 `supabase/rollbacks/` 文件名一一对应。
- `next.config.ts` 钉死 `turbopack.root`，避免开发机主目录的无关 lockfile 把
  workspace root 推断到仓库之外；CSP 仅在 development 放行 `unsafe-eval`。

## Discovery 搜索与发布治理 · 2026-08-07

- 搜索统一走字段权重：标题、作者、摘要优先于长 Prompt，多词查询要求全词命中；
  有查询时按相关度排序，用户选择的热度/稳定度/最新作为次级排序。
- 卡片在命中时显示命中字段、短片段与关键词高亮；无查询时不注入搜索字段。
- `/skills` 在通用 Skill 与作者方法两层内部按固定分类顺序分组并显示每组数量。
- `/cases` 默认浏览同作者最多连续 2 条；这是「尽量」不是「保证」，剩余候选全属
  同一作者时退回原顺序。带搜索词时不做展示层重排。
- Skill 描述与方法步骤基于真实证据生成，每个 Case 最多贡献一句，凑不满两个
  不同 Case 退回定义模板；Case 数、作者数与证据案例只统计真正贡献证据的对象。
- 发布闸门新增 fail-closed 重复治理：规范化来源 URL、同分类相同 Prompt、
  同作者高相似 Prompt。命中时跳过该条继续发其余、末尾列清单并非零退出，
  被拦候选绝不入库。已发布内容索引分页读取，避免 PostgREST 1000 行静默截断。
- 复测 verdict 必须人工输入并显式确认才写库，`inconclusive` 不冲掉已有稳定分，
  生产目标 fail closed。脚本只产出证据，不自动判定。
- 卡片与派生日期统一按 `Asia/Shanghai` 渲染，避免构建机 UTC 与本地差一天。

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
