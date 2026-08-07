<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目协作规则

## 共享真相源
- 开始任何开发前，先读 `docs/PROJECT_STATE.md`
- 开始任何开发前，再读 `docs/WORKLOG.md` 的最新几条
- 不要只根据 `README`、单篇迭代日志或历史文档判断当前阶段

## 收尾规则
- 完成代码或文档修改后，先更新 `docs/PROJECT_STATE.md`
- 再向 `docs/WORKLOG.md` 追加一条本次变更记录
- 若本次修改改变了阶段、品牌、认证状态、数据状态或部署状态，必须同步校准相关说明文档

## 改数据库的硬规则（不可绕过）
- **不要直接改 `supabase/schema.sql` 了事。** 正确做法是在 `supabase/migrations/` 加一个新文件，**同时**在 `supabase/rollbacks/` 加一个同名回滚脚本，两边文件名一一对应。照现有那三组抄，文件名是 `YYYYMMDDHHMMSS_描述.sql`
- `schema.sql` 也要同步更新到最新全量状态，保持「新库跑它一个就够」这个性质
- 迁移必须写成 `if not exists` 这类**幂等**形式。迁移文件自带 `begin`/`commit`，脚本整文件提交不再额外包事务；记录写在迁移提交之后，万一记录那步失败下次会重跑该迁移
- 先跑只读检查 `npm run ops:migrate`（不带参数完全只读，只报哪些待应用、哪些缺 rollback），确认无误再 `npm run ops:migrate -- --apply`
- **历史迁移不要动。** 已应用的迁移记进 `public.schema_migrations` 并存 sha256，改写已应用过的迁移文件脚本会直接报错拦下来；要改就新增一个
- **要退版本走 `npm run ops:migrate -- --rollback --file=<迁移文件名> --yes`，不要手工跑 rollback 脚本。** 手工跑只删结构不删 `schema_migrations` 记录，留下「记录说已应用、结构其实没有」的状态，`--apply` 从此不会再跑它——跟 `--baseline` 建库那个坑是同一类。命令只允许退**最后一个已应用的迁移**（中间那个退掉会让后面的悬空），退多个就从后往前一个一个退
- **回滚会丢数据，跑之前先读对应的 rollback 脚本。** 不加 `--yes` 只打印警告不执行
- 先在自己库上试通，再把改动交给生产库的负责人执行。**生产迁移前必须先备份**

## 内容管道硬规则（不可绕过）
- 案例不是手写进库的，必须走 发现 → 导入 → 审核 → 发布：
  - `npm run supply:shadow` — 影子供给，只写 `tmp/supply-reports`，不碰数据库
  - `npm run import:candidates` — 导入候选
  - `npm run review:candidates` — 人工审核
  - `npm run publish:cases` — 发布上线
- 后三个会写数据库，只在自己的库上跑
- **`scripts/supply/` 里调外部 API 的那些是花钱的**（`SOCIALDATA_API_KEY`、`YOUMIND_INDEX_URL` 之类），动之前先问
- 运营后台在 `/operator`，是唯一的内部审核工作台。**自动化只能发现、预筛、排序和补字段，不能替代人工批准或发布**

## 提 PR 之前（三条全过才算完）
```bash
npm run lint
npm test
npm run build
```
- 改完往 `docs/WORKLOG.md` 顶部加一条

## 当前项目口径
- 当前正式品牌名：`GoodCase.ai`
- 当前项目阶段：`GoodCase.ai 统一版已部署到生产；运营闭环与中文域名迁移继续收敛`
- 当前一级内容对象：`Case`；Creator、Lab、Skill 只作为派生视图
- 当前认证状态：`本月明确不建设账号体系；完整 Prompt 公开`
- 当前互动状态：`收藏和点赞使用 localStorage，不承诺跨设备同步`
- 当前审核状态：`候选通过 review:candidates 人工决策，再由 publish:cases 发布`
- 当前部署状态：`goodcase.ai 已指向统一版生产；常规 Git Preview 仍受 Vercel Git 作者访问校验阻断；goodcase.carlwow.com 尚未解析或上线`
