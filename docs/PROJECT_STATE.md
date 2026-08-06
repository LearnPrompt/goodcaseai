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
