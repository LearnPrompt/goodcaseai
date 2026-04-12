# AI Case Hub MVP

一个面向 `AI 喜爱榜 + AI 稳定榜` 的初步版本。

当前已经完成：

- `Next.js App Router` 工程骨架
- 首页、案例列表、Case 详情、登录页
- 登录前禁止点赞，登录后允许点赞的前端闭环
- `Supabase` 环境变量接入
- 基于 `Supabase Auth` 的客户端注册、登录、退出和会话监听
- 基于 `case_likes` 表的点赞状态读取与写入

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 推荐正式技术栈

- 前端：`Next.js + Tailwind`
- 登录 / 数据库 / 点赞：`Supabase Auth + Postgres + RLS`
- 图片 / 视频素材：`Cloudflare R2`
- 长视频播放量上来之后：`Cloudflare Stream`
- 部署：`Vercel`

## 后续接入点

- 环境变量模板见 `.env.example`
- 数据模型与策略见 `supabase/schema.sql`
- 当前认证状态是 `Supabase 客户端 Auth 已接通`
- 当前点赞状态是 `已接入 case_likes 表`
- 下一步重点不是“从 Demo 切真实登录”，而是补全 `Supabase SSR Auth / callback exchange / 服务端用户态`
- 开发前请先看 `../docs/PROJECT_STATE.md`

## 推送到私有 GitHub

```bash
git remote add origin <your-private-repo-url>
git add .
git commit -m "feat: bootstrap AI Case Hub MVP"
git push -u origin main
```

如果默认分支不是 `main`，把最后一行改成对应分支名。
