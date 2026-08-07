export const PUBLISHED_PAGE_SIZE = 1000;

/**
 * PostgREST 默认最多返回 1000 行，超出部分是**静默**截断的。
 * 重复治理读全量已发布 Case，不分页的话案例涨过 1000 条以后会开始漏检，
 * 而且不报错——比直接失败更难发现。
 */
export async function fetchAllRows(buildQuery, pageSize = PUBLISHED_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/**
 * 来源 URL 是跨分类的硬重复，必须拿全量比；Prompt 只在同分类内比对，
 * 所以 prompt_full 这个最长的字段只取本批候选涉及的分类。
 * 全量 prompt_full 一次是几 MB，而 Supabase Egress 还在宽限期里。
 */
export async function loadPublishedContentIndex(
  supabase,
  categories = [],
  pageSize = PUBLISHED_PAGE_SIZE
) {
  const bySlug = new Map();

  const sourceRows = await fetchAllRows(
    (from, to) =>
      supabase
        .from("cases")
        .select("slug, source_candidate_id, source_url")
        .eq("is_published", true)
        .order("slug", { ascending: true })
        .range(from, to),
    pageSize
  );
  for (const row of sourceRows) {
    bySlug.set(row.slug, { ...row });
  }

  if (categories.length > 0) {
    const promptRows = await fetchAllRows(
      (from, to) =>
        supabase
          .from("cases")
          .select("slug, category, creator_name, prompt_full")
          .eq("is_published", true)
          .in("category", categories)
          .order("slug", { ascending: true })
          .range(from, to),
      pageSize
    );
    for (const row of promptRows) {
      bySlug.set(row.slug, { ...bySlug.get(row.slug), ...row });
    }
  }

  return [...bySlug.values()];
}
