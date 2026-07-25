import type { MetadataRoute } from "next";
import { getCaseSlugs, getCreatorListData } from "@/lib/cases";
import { SITE_ORIGIN } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [caseSlugs, creators] = await Promise.all([
    getCaseSlugs(),
    getCreatorListData(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_ORIGIN}/cases`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_ORIGIN}/creators`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_ORIGIN}/changelog`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_ORIGIN}/connect`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_ORIGIN}/favorites`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_ORIGIN}/submit`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const caseRoutes: MetadataRoute.Sitemap = caseSlugs.map((slug) => ({
    url: `${SITE_ORIGIN}/cases/${encodeURIComponent(slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const creatorRoutes: MetadataRoute.Sitemap = creators.map((creator) => ({
    url: `${SITE_ORIGIN}/creators/${encodeURIComponent(creator.slug)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...caseRoutes, ...creatorRoutes];
}
