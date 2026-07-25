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
- 当前项目阶段：`GoodCase.ai 统一版已部署到生产；运营闭环与中文域名迁移继续收敛`
- 当前一级内容对象：`Case`；Creator、Lab、Skill 只作为派生视图
- 当前认证状态：`本月明确不建设账号体系；完整 Prompt 公开`
- 当前互动状态：`收藏和点赞使用 localStorage，不承诺跨设备同步`
- 当前审核状态：`候选通过 review:candidates 人工决策，再由 publish:cases 发布`
- 当前部署状态：`goodcase.ai 已指向统一版生产；常规 Git Preview 仍受 Vercel Git 作者访问校验阻断；goodcase.carlwow.com 尚未解析或上线`
