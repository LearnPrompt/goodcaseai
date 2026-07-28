# GoodCase 全站中英文切换开发计划

日期：2026-07-28
状态：已按 Idea King 审核结论实施，进入 PR 验收
目标分支：`feat/full-site-i18n-20260728`

## 结论 (Verdict)

needs-attention — 可以做，但不能继续把 Prompt 的 `localStorage` 切换扩展成“全站语言”；必须先建立服务端可识别的 URL 语言、统一词典和内容回退规则，否则会出现页面中文、SEO 英文、Prompt 又是另一种语言的三套状态。

## 事实清单 (Irreducible Facts)

- 中文用户仍是主要服务对象，现有中文 URL 不能因国际化失效。— economics
- 英文页面若要被分享、索引和生成正确 OG，语言必须存在于稳定 URL 中，不能只存在浏览器 `localStorage`。— physics
- 原帖 Prompt 的“原文语言”和网站“界面语言”不是同一件事；用户切换英文界面后仍应能查看中文原文，反之亦然。— physics
- 当前 `html lang`、OpenGraph locale、RSS language 都固定为中文；只有 Prompt 有局部语言状态。— evidence
- 当前 12 个 Case 中只有 1 个存在 `promptTranslationZh`；其余内容尚未达到双语覆盖。— evidence
- 当前审计发现 60 个文件含中文字符串，其中包含页面、组件、数据生成、表单/API 错误、OG、海报、RSS、`llms.txt` 和运营后台。— evidence
- 当前 `src/proxy.ts` 同时负责旧域名跳转与 `/project-intro` 重定向，语言路由必须与它组合，不能另写一套互相争抢顺序的中间件。— evidence
- 两种语言足够；现在没有事实要求加入第三语言、翻译管理后台或外部 i18n SaaS。— convention

## 攻击点 (Attack Points, by severity)

1. **P1 evidence：只用客户端状态会制造假双语。** 无 JavaScript、搜索引擎、微信分享抓取和首次加载仍会得到中文 metadata 或错误 `lang`。
   → 证伪实验：无 Cookie、禁用 JavaScript，直接请求 `/en/cases/real-case-01-umesh-ai`；HTML 首包必须已经是英文，包含 `lang="en"`、英文 title/description、英文 canonical/alternate 和英文可见正文。

2. **P1 evidence：把界面语言与 Prompt 原文绑定，会丢失证据。** 英文 UI 不等于原 Prompt 是英文；自动覆盖原文会破坏 Case 的可追溯性。
   → 证伪实验：准备“英文原文+中文译文”“中文原文+英文译文”“只有原文”三种 fixture，在中英文界面分别打开；六种组合都必须显示正确默认文本，并始终能返回原文。

3. **P1 evidence：只翻正常页面必然漏掉系统面。** 当前硬编码文本分散在 404、错误页、加载态、表单校验、运营动作、海报、OG、RSS、公开 API 和生成式 Creator 文案中。
   → 证伪实验：建立完整路由/输出矩阵和词典键一致性测试；故意在英文 404 或海报中塞入一条中文硬编码，测试必须失败。

## 幸存结论 (What Survives)

- 保留中文优先，不改变 GoodCase 当前产品定位。
- 全站只提供 `zh-CN` 与 `en` 两种界面语言。
- 中文继续使用现有路径；英文使用 `/en/...`，同一个 Case 共用 slug、收藏、点赞和证据数据。
- 顶部只保留一个全局“中文 / EN”切换，不在每个页面重复设置。
- Prompt 原文继续保留；全局语言只决定默认显示哪个译文，不删除“原文”入口。
- 不引入第三方翻译 SaaS，不为 211 条候选提前生成无用译文；只给最终发布内容补齐翻译。

## 修改建议 (Changes)

- 用服务端 URL locale 替代“仅 localStorage 的界面语言”，Cookie 只记偏好，不作为唯一真相源。
- UI 文案进入类型安全词典；Case 内容进入可审计的翻译字段，两者不混在一个对象里。
- 将现有 `goodcase:prompt-language` 保留为“Prompt 原文/译文偏好”，默认值由当前站点 locale 决定。
- 先完成一条首页和一条 Case 详情的纵向样板，再批量迁移，避免翻完页面才发现 SEO/Proxy 架构不成立。
- 新建独立 i18n 分支和 PR，不继续扩大 PR #7；该分支从 PR #7 的 Prompt 双语基础上开始。

## 一、范围基线

### 1. 公开页面：9 类

| 页面 | 中文 URL | 英文 URL |
|---|---|---|
| 首页 | `/` | `/en` |
| 案例库 | `/cases` | `/en/cases` |
| 案例详情 | `/cases/[slug]` | `/en/cases/[slug]` |
| 创作者列表 | `/creators` | `/en/creators` |
| 创作者详情 | `/creators/[slug]` | `/en/creators/[slug]` |
| 收藏 | `/favorites` | `/en/favorites` |
| 更新日志 | `/changelog` | `/en/changelog` |
| 接入/关于/反馈 | `/connect` | `/en/connect` |
| 投稿 | `/submit` | `/en/submit` |

`/project-intro` 继续 301 到 `/connect#about`；英文对应 `/en/project-intro` → `/en/connect#about`。

### 2. 系统状态：5 类

- 全局 Loading
- Case 列表 Loading
- 404
- 页面 Error
- Global Error

### 3. 内部运营：2 类

- `/operator/login`
- `/operator` 的候选、反馈、统计、详情弹层、筛选、操作结果与错误提示

内部页不参与搜索索引，但仍跟随团队选择的语言。

### 4. 生成与机器输出

- 首页 OG 图
- Case OG 图
- 分享海报
- RSS：中文 `/feed.xml`，英文 `/en/feed.xml`
- `llms.txt`：中文默认，英文 `/en/llms.txt`
- 公开 API：列表、详情支持 `?locale=zh-CN|en`
- sitemap：输出中英文 URL 与 alternates
- robots：保持语言无关
- 提交与反馈 API：根据表单携带的 locale 返回对应错误/成功文案

### 5. 数据内容

- Case：标题、摘要、Prompt 翻译、结果拆解、编辑说明、Lab 说明
- Creator：bio、标签、精选标识与生成模板
- Changelog：标题、条目、标签
- 分类、成本、证据、状态等枚举
- 表单 placeholder、aria-label、空状态、Toast、按钮进行态

作者 ID、模型名、平台名、URL、代码、原始 Prompt 不做强制翻译。

## 二、架构决定

### 1. URL 与语言解析

推荐方案：

```text
中文 canonical:  /cases/slug
英文 canonical:  /en/cases/slug
中文默认入口:    /
英文默认入口:    /en
```

解析顺序：

1. URL `/en` 明确指定英文。
2. 无前缀路径固定为中文，确保已有链接不漂移。
3. `goodcase_locale` Cookie 只用于语言切换后的回访提示，不偷偷重定向用户。
4. 不按 IP、浏览器地区或 `Accept-Language` 自动跳转，避免中文用户在海外被强制切英文。

### 2. 路由结构

- 在 `src/proxy.ts` 中统一处理：项目旧路径、旧域名、locale rewrite。
- 公共页面内部统一收到 `locale`，但中文浏览器地址保持无前缀。
- API、静态资源、`auth` 不进入页面 locale rewrite。
- 所有站内链接通过 `localizedHref(locale, href)` 生成，保留 query 与 hash。
- Language Switcher 在相同路径切换 `/en` 前缀，不跳回首页。

### 3. UI 词典

不先增加 `next-intl` 等依赖。两种语言用类型安全的本地词典即可：

```text
src/i18n/config.ts
src/i18n/messages/zh-CN.ts
src/i18n/messages/en.ts
src/i18n/get-messages.ts
src/i18n/localized-href.ts
src/components/locale-provider.tsx
src/components/language-switcher.tsx
```

规则：

- 中文词典定义完整类型，英文必须 `satisfies` 同一结构。
- Server Component 直接拿 locale/messages。
- Client Component 从轻量 LocaleProvider 读取。
- 禁止组件里新增用户可见硬编码；品牌名、模型名和原始来源除外。

### 4. Case 翻译数据

建议 Supabase 增加：

```sql
content_locale text
translations jsonb not null default '{}'::jsonb
```

`translations` 结构：

```json
{
  "zh-CN": {
    "title": "",
    "summary": "",
    "promptFull": "",
    "resultBreakdown": [],
    "editorNote": "",
    "labNote": []
  },
  "en": {
    "title": "",
    "summary": "",
    "promptFull": "",
    "resultBreakdown": [],
    "editorNote": "",
    "labNote": []
  }
}
```

原则：

- 现有字段继续保存来源/主内容，迁移可回滚。
- 发布时只要求至少一种完整语言，不要求投稿者双语填写。
- 另一语言缺失时显示原文并标注 `Original / 原文`，不显示空白，也不自动编造。
- 翻译必须经过运营确认后才进入 published Case。
- 211 条候选只在“批准发布”后翻译，内容自动化仍是独立工作流。

### 5. Prompt 语言

- 全局站点 locale：决定 UI 和 Prompt 默认译文。
- Prompt 内容切换：保留“原文 / 中文译文 / English translation”能力。
- `goodcase:prompt-language` 只记用户是否偏好原文；不再冒充网站 locale。
- 分享链接和 SEO 永远由 URL locale 决定，不由 Prompt 偏好决定。

### 6. API 兼容

- 不带 `locale` 的公开 API 维持当前中文优先输出，避免 Agent/Skill 兼容性破坏。
- `?locale=en` 返回解析后的 `title`、`summary`、`promptPreview`。
- 增加 `contentLocale`、`availableLocales`、`isFallback`。
- 响应增加 `Content-Language`，缓存键必须包含 locale。
- 搜索同时匹配原文与两种翻译；当前数据量不先增加复杂全文索引。

## 三、实施阶段

### M0：架构样板与失败实验（预计 0.5 天）

交付：

- locale 类型、路径规则和 typed dictionary 骨架。
- `/` 与 `/en` 首页样板。
- 一条 Case 在中文/英文 URL 下的 SSR、metadata、Prompt 原文回退。
- Proxy 与旧域名重定向顺序测试。

通过条件：

- `curl /en` 首包已经是英文。
- `/cases/slug` 与 `/en/cases/slug` canonical 不互相覆盖。
- `/project-intro`、legacy redirect、query/hash 不丢失。

### M1：全局基础设施（预计 1 天）

交付：

- 全局 Language Switcher。
- SiteHeader、SiteShell、根 layout、metadata 工厂。
- `html lang`、cookie、localized links。
- Prompt 偏好与站点 locale 解耦。
- 字典键一致性测试。

通过条件：

- 任意页面切换语言后停留在同一内容。
- 刷新、复制链接、新标签打开语言不变。
- 收藏/点赞 slug 与语言无关，切换后数据仍在。

### M2：公开页面与组件迁移（预计 2 天）

批次 A：

- 首页、案例列表、CaseCard、搜索、分类、榜单。

批次 B：

- Case 详情、Prompt、复用方法、相关 Case、分享。

批次 C：

- Creator、Favorites、Changelog、Connect、Submit、Feedback。

批次 D：

- Loading、404、Error、Global Error、所有空状态和 aria-label。

每批通过后再进入下一批，避免一次大改难以回归。

### M3：内容模型与首批回填（预计 1.5 天）

交付：

- Supabase migration + rollback。
- `CaseItem` 的 locale resolver 和严格 fallback。
- 当前 12 个 Case 的标题、摘要、Prompt 与结果拆解双语回填。
- Creator 生成模板和 Changelog 双语。
- Operator 能看到翻译覆盖状态并编辑/确认译文。

通过条件：

- 三种 fixture 的六种语言组合全部通过。
- 缺译文时明确显示原文，不出现空卡片或伪翻译。
- migration 回滚不删除原始内容。

### M4：SEO、分享与机器接口（预计 1 天）

交付：

- 双语 metadata、canonical、`hreflang`、`x-default`。
- sitemap 中英 alternates。
- 首页/Case OG 双语。
- 分享海报双语，二维码指向当前语言 URL。
- RSS、`llms.txt`、公开 API locale。
- analytics 增加 locale，但事件名与 Case slug 不分叉。

通过条件：

- 微信/X 分享中英文链接得到对应语言标题、说明与图片。
- RSS 声明正确 language。
- API locale 缓存不串语言。

### M5：运营后台与表单闭环（预计 1 天）

交付：

- Operator 登录、列表、详情、筛选、统计、动作反馈全双语。
- 投稿/反馈表单、API 校验错误、成功回执双语。
- 候选翻译状态：未翻译、机器草稿、已人工确认。
- 飞书内部通知继续中文，不属于网站 UI，避免扩大范围。

### M6：全量验收与发布（预计 1 天）

自动检查：

```bash
npm test
npm run lint
npm run build
git diff --check
```

新增检查：

- dictionary parity test
- hardcoded user-facing string guard
- locale route/proxy test
- content fallback matrix test
- API locale/cache test
- no-JS SSR smoke test

人工矩阵：

- 375 / 768 / 1440 三种宽度
- 中文与英文
- 正常、空数据、错误、Loading
- 微信内置浏览器与桌面浏览器
- 首页、Case、Creator、收藏、投稿、反馈、运营

## 四、Definition of Done

只有同时满足以下条件才叫“全站双语完成”：

- 9 类公开页面、5 类系统状态、2 类运营页面全部能切换。
- 英文页面首包、metadata、OG、海报、RSS、API 都是英文，不依赖 hydration 后替换。
- 中文 URL 保持不变；英文 URL 可复制、刷新、分享和索引。
- 所有站内链接切换语言后仍指向同一实体。
- Prompt 原文永远可访问，缺译文时有明确 fallback。
- 当前 12 个公开 Case 双语覆盖完成；后续 Case 发布前有翻译状态门槛。
- 词典不存在漏键；英文页面没有意外中文 UI，中文页面没有无理由英文 UI。
- 收藏、点赞、搜索、表单、反馈、Operator、分析事件无回归。
- 测试、Lint、Build、Proxy/SSR smoke 全部通过。
- Preview 经中英文人工矩阵验收后才合并，不直接在生产试错。

## 五、明确不做

- 不增加第三语言。
- 不建立独立英文站或新域名。
- 不让用户投稿时填写两套语言。
- 不在运行时调用外部翻译 API。
- 不提前翻译 211 条尚未批准的候选。
- 不把 UI 国际化和内容自动采集绑成同一个 PR。
- 不因为英文版复制一套 Case、Creator、收藏或榜单数据。

## 未解疑问 (Open Questions)

- 英文是否需要独立可索引 URL？推荐答案：**需要，使用 `/en/...`，中文保留现有路径。**
  impact：如果只要本机切换、不要英文 SEO，可以改成 Cookie-only，工作量会下降，但分享、搜索收录、OG 和无 JS 首包都不是真正英文。

## 工期

估算：单人配合 AI 开发约 **6–8 个开发日**。
这是实现估算，不是上线承诺；最大变量是首批 12 个 Case 的人工翻译与验收质量。
