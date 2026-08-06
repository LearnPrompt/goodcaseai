import type { MetadataRoute } from "next";
import { MODEL_FAMILIES } from "@/lib/models";
import { getSitemapData } from "@/lib/sitemap-data";
import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { caseSlugs, creatorSlugs, skillSlugs } = await getSitemapData();

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
    ...localizedEntries("/skills", "daily", 0.85),
    ...localizedEntries("/models", "daily", 0.85),
    ...localizedEntries("/creators", "daily", 0.8),
    ...localizedEntries("/changelog", "weekly", 0.5),
    ...localizedEntries("/connect", "monthly", 0.5),
    ...localizedEntries("/agent-api", "monthly", 0.6),
    ...localizedEntries("/favorites", "monthly", 0.4),
    ...localizedEntries("/submit", "monthly", 0.4),
  ];

  const caseRoutes: MetadataRoute.Sitemap = caseSlugs.flatMap((slug) =>
    localizedEntries(`/cases/${encodeURIComponent(slug)}`, "weekly", 0.7)
  );

  const creatorRoutes: MetadataRoute.Sitemap = creatorSlugs.flatMap((slug) =>
    localizedEntries(
      `/creators/${encodeURIComponent(slug)}`,
      "weekly",
      0.6
    )
  );

  const skillRoutes: MetadataRoute.Sitemap = skillSlugs.flatMap((slug) =>
    localizedEntries(`/skills/${encodeURIComponent(slug)}`, "weekly", 0.55)
  );

  const modelRoutes: MetadataRoute.Sitemap = MODEL_FAMILIES.flatMap((family) =>
    localizedEntries(`/models/${family.slug}`, "daily", 0.75)
  );

  return [
    ...staticRoutes,
    ...caseRoutes,
    ...creatorRoutes,
    ...skillRoutes,
    ...modelRoutes,
  ];
}
