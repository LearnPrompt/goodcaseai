import type { Metadata } from "next";
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
    <SiteShell footerNote="收藏保存在本机浏览器，登录体系接入后会升级为跨设备同步。">
      <section className="mb-7 grid gap-4 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Favorites
        </p>
        <h1 className="max-w-[13ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-7xl">
          我的收藏
        </h1>
      </section>

      <FavoritesList />
    </SiteShell>
  );
}
