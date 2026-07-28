import "server-only";

import { slugifyCreatorName } from "@/lib/creator-slug";
import { caseItems } from "@/lib/mock-data";

type SitemapCaseRow = {
  slug: string;
  creator_name: string | null;
};

const PAGE_SIZE = 1_000;

async function fetchPublishedSitemapRows(): Promise<SitemapCaseRow[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    return null;
  }

  const rows: SitemapCaseRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URL("/rest/v1/cases", baseUrl);
    query.searchParams.set("select", "slug,creator_name");
    query.searchParams.set("is_published", "eq.true");
    query.searchParams.set("order", "slug.asc");
    query.searchParams.set("limit", String(PAGE_SIZE));
    query.searchParams.set("offset", String(offset));

    const response = await fetch(query, {
      cache: "no-store",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Accept-Profile": "public",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load sitemap data: ${response.status} ${await response.text()}`
      );
    }

    const page = (await response.json()) as SitemapCaseRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getSitemapData() {
  const rows =
    (await fetchPublishedSitemapRows()) ||
    caseItems.map((item) => ({
      slug: item.slug,
      creator_name: item.creator,
    }));

  return {
    caseSlugs: Array.from(
      new Set(
        rows
          .map((row) => row.slug?.trim())
          .filter((slug): slug is string => Boolean(slug))
      )
    ),
    creatorSlugs: Array.from(
      new Set(
        rows
          .map((row) => row.creator_name?.trim())
          .filter((name): name is string => Boolean(name))
          .map(slugifyCreatorName)
          .filter(Boolean)
      )
    ),
  };
}
