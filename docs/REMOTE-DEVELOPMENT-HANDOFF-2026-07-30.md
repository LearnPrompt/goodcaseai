# GoodCase.ai 远程开发交接

> 快照时间：2026-07-30
>
> 公开仓库：<https://github.com/LearnPrompt/goodcaseai>
>
> 当前生产站：<https://goodcase.ai>
> 本文只记录可同步到公开仓库的开发事实，不包含环境变量值、账号、证件、备案订单号或私有网络地址。

## 1. 当前唯一产品口径

- 唯一产品是 **GoodCase.ai**，公开侧唯一一级内容对象是 **Case**。
- Creator 是已发布 Case 的作者聚合；Lab 是 Case 内的复测与稳定性证据。
- Skill 必须从多个已发布 Case 的共同方法中归纳，并产出可真正安装的标准 `SKILL.md` 包。
- LearnPrompt 只保留为可统计的外部学习入口，不迁移教程库。
- DoneBlock 可以作为披露利益关系的硬件 Case，不进入硬件总榜。
- 完整 Prompt、RSS、公开 API 和 Case 浏览不要求公众账号。
- 收藏和点赞只保存在浏览器本机，不承诺跨设备同步。
- `/operator` 是唯一内部审核工作台；自动化只能发现、预筛、排序和补字段，不能替代人工批准或发布。

## 2. 线上事实快照

| 项目 | 已核对状态 |
| --- | --- |
| GitHub `main` | `445676b38cc7742bfaa07b8b5717bbc5aaee6b7c` |
| 最新 Production | 同一 SHA；Vercel 于 `2026-07-28T15:06:04.225Z` READY |
| 24 小时稳定性 | 2026-07-30 复检为 `42.8h observed` |
| 主站 | `https://goodcase.ai` 返回 `200` |
| Sitemap | `200`；311 个唯一 Case、208 个唯一 Creator、24 个唯一 Skill |
| `www` 跳转 | `www.goodcase.ai/en/cases/example?from=www` 返回保留路径与查询参数的 `301` |
| 安全响应头 | CSP、HSTS、Referrer-Policy、Permissions-Policy、X-Content-Type-Options、X-Frame-Options 均存在 |
| 英文 Case | `/en/cases/16mm-vlog-c8cfec0d8310` 返回英文标题 |
| Skill 安装 | `/skills` 显示 24 个可安装包；`web-3d-motion-hero` 页面含 `npx skills add` 命令；`.skill` 包返回 `200` |
| Creator | `/creators/viktoroddy` 返回 `200` |
| 开放 PR | 0 |
| 当前代码验收 | 171/171 tests、lint、production build（59 个页面结果）通过 |
| 生产依赖审计 | `npm audit --omit=dev` 为 0；`npm ci` 汇总仍显示 9 个 dev/optional 依赖 high，禁止用 `--force` 破坏性降级 |

Production aliases 包括 `goodcase.ai`、`www.goodcase.ai`、`goodcase.carlwow.com` 和 Vercel 默认域名。Alias 已存在不等于 DNS 已生效。

## 3. 2026 年开发时间线

### 4 月：从 AI Case Hub 收敛为 GoodCase.ai

- 完成 GoodCase 品牌统一、工业编辑视觉、Case/Creator 页面和 SSR 基础。
- 早期“登录解锁 Prompt、服务端点赞、四个并列产品”的设计后来被奥卡姆裁决覆盖，不能再当作当前需求。
- 建立 `PROJECT_STATE.md + WORKLOG.md` 的共享真相源习惯。

### 5 月：真实 Case、Supabase 和首个 Production

- 从飞书库迁入真实 Case 与媒体，替换假案例。
- 仓库更名为 `LearnPrompt/goodcaseai`，Vercel 项目与自定义域名建立。
- 首页吸收 Claude Design 的信息密度，但保留真实数据派生逻辑。
- 将认证主链路改为同源 API，降低浏览器直连 Supabase 的网络风险。

### 7 月 23 日：奥卡姆统一版

- 所有公开页面统一到 GoodCase 的黑白网格、橙色信号色和零圆角语言。
- Case 详情收敛为：作品结果 → 中英 Prompt → 可复用方法 → Creator。
- 删除虚假的成熟 Skill、独立 Lab、伪实时供给承诺和重复解释区。
- 完成 Case-first 的 Agent 接入、公开 API、RSS、Sitemap、投稿与反馈入口。

### 7 月 25–26 日：审核、运营和域名门槛

- 建立发现与发布分离的供给引擎、人工审核队列、发布硬门和可续跑发布脚本。
- `/operator` 收敛为候选与反馈共用的受保护工作台。
- 增加首方匿名统计、飞书收件提醒、Agent 机器入口与域名迁移检查脚本。
- GitHub PR #1–#5 合入统一页面、稳定性门槛、每日队列、域名检查和运营/Agent 接入。

### 7 月 27 日：YouMind 与多来源人工校准

- YouMind、X/SocialData、案例库和多来源样本只负责供给；人工判断仍是事实源。
- 图片、网站、视频候选的所有人工决定固化在 `scripts/review/data/*.json`。
- 映射生产状态时坚持：先私有备份、UUID/原帖 URL 精确匹配、dry-run、再 apply；禁止标题模糊匹配。
- `approved` 只是已通过审核，绝不能写成 `published`。

### 7 月 28 日：双语、留存、Skills 与上线加固

| PR | 内容 | 结果 |
| --- | --- | --- |
| #6 | 候选校准与人工审核工作流 | merged |
| #7 | Case 留存、相关 Case、Prompt 呈现 | merged |
| #8 | 全站中英文切换 | merged |
| #9 | standalone deployment output | closed / 未合并 |
| #10 | 人工决定持久化、收紧 Web Case 发现 | merged |
| #11 | 上线加固、SEO、安全与运营检查 | merged |
| #12 | Creator 方法和共享 Skills | merged |
| #13 | 24 个可安装、证据驱动的 Skills | merged |
| #14 | Skill 回挂 Case、Creator 头像补全 | merged |

### 7 月 29–30 日：备案与稳定性

- 备案材料已提交，火山引擎订单已完成“提交管局中”，当前页面明确显示“等待短信核验”。
- 收到工信部短信后必须在 24 小时内完成短信核验；完成后才进入管局审核。
- 新 Production 自 `2026-07-28T15:06:04.225Z` 起已通过 42.8 小时稳定性复检。
- `goodcase.carlwow.com` 当前仍无法解析；微信真机打开、分享、视频和投稿未验收；`.ai` 301 不得提前开启。

## 4. 当前系统结构

### 前台

- Next.js App Router + React + Tailwind CSS。
- 中英文路由、Case/Creator/Skill 列表和详情、收藏、投稿、反馈、更新日志、Agent 接入。
- 完整 Prompt 公开；列表显示摘要，详情展示完整内容。
- SEO 包括 metadata、RSS、Sitemap、robots、OG 图片、`llms.txt`。

### 数据

- Supabase 是生产数据源；无连接时保留 fallback。
- 关键对象：`cases`、`case_candidates`、`feedback_messages`、`analytics_events`。
- 发布 Case 用 `source_candidate_id` 回挂候选，支持中断续跑并防止错误改绑。
- 当前迁移：
  - `20260723000000_goodcase_occam.sql`
  - `20260728000000_goodcase_i18n.sql`
  - `20260728010000_goodcase_creator_avatars.sql`
- 每个迁移都有对应 rollback；执行生产迁移前仍必须备份。

### 供给与人工审核

信号源与 Case 主体要分开：

- 主体优先：X、公众号、小红书、抖音、B 站等创作者原帖。
- 信号/种子：AI News Radar、AIHot、GitHub Trending、TrendingRepo、last30days、YouMind。
- 富化工具：SocialData、原帖线程、媒体与公开 Prompt。
- 发现默认只写 `tmp/supply-reports`；只有人工确认后才进入 `import → review → publish`。

常用命令：

```bash
npm run supply:shadow
npm run supply:youmind
npm run supply:multisource
npm run supply:prepare-multisource

npm run import:candidates -- --file=tmp/case-candidates.json
npm run review:candidates
npm run review:candidates -- --action=approve --id=<candidate-uuid>
npm run publish:cases
```

### Skills

- 生成器：`scripts/skills/generate-installable-skills.mjs`。
- 源目录：`skills/generated/<skill-name>/`。
- 每个包至少包含 `SKILL.md` 和 `references/cases.md`，必须保留 Case、作者和证据来源。
- 公共包：`public/skill-packages/*.skill`。
- 新建包需要 `SKILL_CREATOR_ROOT` 指向可信的 Skill Creator 安装；不能凭名称猜一个方法包。

## 5. 仓库与分支状态

- `origin/main` 是唯一 Production 基线。
- 当前已合并功能分支均保留在 Git 历史中，不需要从旧工作树恢复。
- 尚未合并的视觉分支：
  - `origin/feat/three-column-case-grid-20260728`
  - 最新提交 `153ea47e4ef1de692ec841778731fb9e3666579d`
  - 修改 Case 列表为 3/2/1 响应式网格并缓和媒体 letterbox。
  - 当前没有 PR；远程接手后必须先重放到最新 `main`、重新验收，再决定是否建 PR。
- 不要把本机其他历史 worktree 当作主分支，也不要直接删除它们。

## 6. 远程电脑接手

### 已有仓库时

先检查本地修改，绝不覆盖：

```bash
cd /path/to/goodcaseai
git status --short --branch
git remote -v
```

只有工作树干净时才执行：

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run lint
npm run build
```

如果 `git status` 非空，先把修改提交到独立分支或创建补丁，不要运行 reset、checkout 覆盖或清理命令。

### 尚未克隆时

```bash
git clone https://github.com/LearnPrompt/goodcaseai.git
cd goodcaseai
npm ci
cp .env.example .env.local
```

`.env.local` 必须在远程电脑单独恢复，禁止通过 Git、聊天或交接文档传输值。需要在线运维时，在远程电脑上分别完成 GitHub、Vercel 和 Supabase 的交互式授权。

### 接手后的第一轮只读验证

```bash
git rev-parse HEAD
gh pr list --repo LearnPrompt/goodcaseai --state open
vercel list --environment production --status READY --format json

node scripts/ops/check-domain-readiness.mjs \
  --target-origin=https://goodcase.ai \
  --expected-ip=76.76.21.21 \
  --stable-since=2026-07-28T15:06:04.225Z \
  --json
```

域名脚本退出码 `2` 不一定表示网站坏了；当前预期 blocker 是备案获批和微信真机证据。

## 7. 环境变量边界

仓库现在提交了脱敏 `.env.example`，只列变量名和安全默认值。

- 公共前端：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`。
- 服务端敏感：`SUPABASE_SERVICE_ROLE_KEY`。
- Operator：`GOODCASE_OPERATOR_USER_ID`、`GOODCASE_OPERATOR_PASSWORD`、`GOODCASE_OPERATOR_SESSION_SECRET`。
- 通知：`GOODCASE_OWNER_WEBHOOK_URL`、`GOODCASE_OWNER_WEBHOOK_FORMAT`。
- 域名：`NEXT_PUBLIC_SITE_URL`、`GOODCASE_CANONICAL_ORIGIN`、`GOODCASE_ENABLE_LEGACY_REDIRECT`。
- 供给：`RADAR_FEED_URL`、`YOUMIND_INDEX_URL`、`SOCIALDATA_API_KEY`。
- 本地富化：`OLLAMA_HOST`、`OLLAMA_VISION_MODEL`。
- Skill：`SKILL_CREATOR_ROOT`。

任何日志、PR、Issue、截图和聊天里都不能出现变量值。

## 8. 下一阶段优先级

1. 收到短信后 24 小时内完成 ICP 短信核验，并等待管局审核；备案“已提交”不等于“已通过”。
2. 备案通过后再配置 `goodcase.carlwow.com` DNS，完成 Vercel 自动验证与 HTTPS。
3. 用中文微信真机验证首页、Case、视频、分享、投稿；HTTP 微信 UA smoke 不能代替真机。
4. 新域稳定 24–48 小时后，再显式开启逐路径 301；必须保留路径和查询参数。
5. 评审 `feat/three-column-case-grid-20260728`，不要无验收直接合并。
6. 继续补 L2 复测、内容许可和 Creator 头像；自动化仍保持人工批准门槛。

## 9. 每次开发的收尾清单

```text
1. git status / git diff
2. 最小相关测试
3. npm test
4. npm run lint
5. npm run build
6. 更新当前状态与工作日志
7. 推送分支并创建 PR
8. 合并后核对 GitHub main SHA
9. 核对 Vercel Production SHA 与 READY 时间
10. 分开报告 local / preview / production / 微信真机
```

禁止把以下状态互相替代：

- 浏览器里看见页面 ≠ 已保存
- 本地通过 ≠ Preview
- Preview ≠ Production
- `approved` ≠ `published`
- Vercel alias ≠ DNS 生效
- 微信 UA HTTP 200 ≠ 微信真机通过
- 备案材料已上传/已提交 ≠ 备案获批
