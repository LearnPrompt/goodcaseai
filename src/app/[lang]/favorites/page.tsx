import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { FavoritesList } from "@/components/favorites-list";

export const metadata: Metadata = {
  title: "我的收藏 · 好案例",
  description: "你在 GoodCase.ai 收藏的 AI 案例都在这里，收藏保存在本机浏览器，免登录即可使用。",
  alternates: {
    canonical: "/favorites",
  },
};

export default function FavoritesPage() {
  return (
    <SiteShell footerNote="收藏保存在本机浏览器，不要求登录，也不会上传个人书架。">
      <PageHero
        eyebrow="Favorites · 本地书架"
        title="把值得复看的 Case 留在手边。"
        description="收藏只是个人工作台，不生成另一套内容。每条收藏仍然回到同一个 Case、作者、Prompt 和复测记录。"
      />

      <div className="py-7">
        <FavoritesList />
      </div>
    </SiteShell>
  );
}
