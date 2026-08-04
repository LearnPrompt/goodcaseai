# PROJECT_STATE

> 共享真相源。开始任何开发前先读这里，再看 [WORKLOG.md](./WORKLOG.md) 的最新几条。
> 完成修改后先更新本文件，再向 WORKLOG 追加记录。

## 项目口径

- 正式品牌名：GoodCase.ai
- 项目阶段：统一版已部署到生产；运营闭环与中文域名迁移继续收敛
- 一级内容对象：Case；Creator、Lab、Skill 只作为派生视图
- 认证状态：本月明确不建设账号体系；完整 Prompt 公开
- 互动状态：收藏和点赞使用 localStorage，不承诺跨设备同步
- 审核状态：候选通过 review:candidates 人工决策，再由 publish:cases 发布
- 部署状态：goodcase.ai 已指向统一版生产；常规 Git Preview 仍受 Vercel Git
  作者访问校验阻断；goodcase.carlwow.com 尚未解析或上线

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

- Supabase Free Plan 上个账期 Egress 超限，宽限期到 2026-09-01，逾期后请求
  返回 402。列表页已于 08-03 切本地缩略图，本账期流量应明显回落；
  9 月前需回 Usage 页确认降没降下来，没降就把详情页媒体也本地化或升 Pro
