import type { MetadataRoute } from "next";
import { getCaseSlugs, getCreatorListData } from "@/lib/cases";
import { SITE_ORIGIN } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [caseSlugs, creators] = await Promise.all([
    getCaseSlugs(),
    getCreatorListData(),
  ]);

  function localizedEntries(
    path: string,
    changeFrequency: NonNullable<
      MetadataRoute.Sitemap[number]["changeFrequency"]
    >,
    priority: number
  ): MetadataRoute.Sitemap {
    const zhUrl = `${SITE_ORIGIN}${path}`;
    const enUrl = `${SITE_ORIGIN}/en${path === "/" ? "" : path}`;
    const alternates = {
      languages: {
        "zh-CN": zhUrl,
        en: enUrl,
      },
    };
    return [
      { url: zhUrl, changeFrequency, priority, alternates },
      { url: enUrl, changeFrequency, priority, alternates },
    ];
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    ...localizedEntries("/", "daily", 1),
    ...localizedEntries("/cases", "daily", 0.9),
    ...localizedEntries("/creators", "daily", 0.8),
    ...localizedEntries("/changelog", "weekly", 0.5),
    ...localizedEntries("/connect", "monthly", 0.5),
    ...localizedEntries("/favorites", "monthly", 0.4),
    ...localizedEntries("/submit", "monthly", 0.4),
  ];

  const caseRoutes: MetadataRoute.Sitemap = caseSlugs.flatMap((slug) =>
    localizedEntries(`/cases/${encodeURIComponent(slug)}`, "weekly", 0.7)
  );

  const creatorRoutes: MetadataRoute.Sitemap = creators.flatMap((creator) =>
    localizedEntries(
      `/creators/${encodeURIComponent(creator.slug)}`,
      "weekly",
      0.6
    )
  );

  return [...staticRoutes, ...caseRoutes, ...creatorRoutes];
}
