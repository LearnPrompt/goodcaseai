import type { MetadataRoute } from "next";
import { getCaseSlugs, getCreatorListData } from "@/lib/cases";

const BASE_URL = "https://goodcase.ai";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [caseSlugs, creators] = await Promise.all([
    getCaseSlugs(),
    getCreatorListData(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/cases`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/creators`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/project-intro`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const caseRoutes: MetadataRoute.Sitemap = caseSlugs.map((slug) => ({
    url: `${BASE_URL}/cases/${encodeURIComponent(slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const creatorRoutes: MetadataRoute.Sitemap = creators.map((creator) => ({
    url: `${BASE_URL}/creators/${encodeURIComponent(creator.slug)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...caseRoutes, ...creatorRoutes];
}
