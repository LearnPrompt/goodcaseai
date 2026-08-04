# WORKLOG

> 追加式变更日志，最新的在最上面。每次代码或文档修改收尾时补一条。

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
