<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目协作规则

## 共享真相源
- 开始任何开发前，先读 `../docs/PROJECT_STATE.md`
- 开始任何开发前，再读 `../docs/WORKLOG.md` 的最新几条
- 不要只根据 `README`、单篇迭代日志或历史文档判断当前阶段

## 收尾规则
- 完成代码或文档修改后，先更新 `../docs/PROJECT_STATE.md`
- 再向 `../docs/WORKLOG.md` 追加一条本次变更记录
- 若本次修改改变了阶段、品牌、认证状态、数据状态或部署状态，必须同步校准相关说明文档

## 当前项目口径
- 当前正式品牌名：`GoodCase.ai`
- 当前项目阶段：`MVP 已可操作，供给与审核后台待补齐`
- 当前认证状态：`Supabase 客户端 Auth 已接通，SSR Auth / callback exchange 未完成`
- 当前点赞状态：`已接入 Supabase case_likes 表，不再使用 localStorage`
