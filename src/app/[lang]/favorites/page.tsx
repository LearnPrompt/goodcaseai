import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { FavoritesList } from "@/components/favorites-list";
import { localizeHref } from "@/i18n/config";
import { getLocaleFromParams } from "@/i18n/server";

type PageParams = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  return {
    title: isEnglish ? "My Favorites" : "我的收藏 · 好案例",
    description: isEnglish
      ? "Cases you save on GoodCase.ai stay in this browser and require no account."
      : "你在 GoodCase.ai 收藏的 AI 案例都在这里，收藏保存在本机浏览器，免登录即可使用。",
    alternates: {
      canonical: localizeHref(locale, "/favorites"),
      languages: {
        "zh-CN": "/favorites",
        en: "/en/favorites",
        "x-default": "/favorites",
      },
    },
  };
}

export default async function FavoritesPage({
  params,
}: {
  params: PageParams;
}) {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Favorites stay in your browser. No login and no uploaded personal shelf."
          : "收藏保存在本机浏览器，不要求登录，也不会上传个人书架。"
      }
    >
      <PageHero
        eyebrow={isEnglish ? "Favorites · Local shelf" : "收藏 · 本地书架"}
        title={
          isEnglish
            ? "Keep the cases worth revisiting close."
            : "把值得复看的 Case 留在手边。"
        }
        description={
          isEnglish
            ? "Favorites are a personal workspace, not another content library. Every saved item still resolves to the same case, creator, prompt, and retest record."
            : "收藏只是个人工作台，不生成另一套内容。每条收藏仍然回到同一个 Case、作者、Prompt 和复测记录。"
        }
      />

      <div className="py-7">
        <FavoritesList />
      </div>
    </SiteShell>
  );
}
