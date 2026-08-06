export const CASE_COLUMNS = [
  "slug",
  "title",
  "category",
  "source_platform",
  "source_url",
  "source_like_count",
  "source_comment_count",
  "source_share_count",
  "source_save_count",
  "source_published_at",
  "source_metrics_captured_at",
  "creator_name",
  "creator_avatar_url",
  "summary",
  "prompt_preview",
  "prompt_full",
  "content_locale",
  "translations",
  "translation_status",
  "media_kind",
  "media_url",
  "poster_url",
  "remake_count",
  "stability_score",
  "favorite_score",
  "recommended_models",
  "cost_band",
  "evidence_level",
  "tags",
  "is_published",
  "created_at",
];

export const SEED_BATCH_SIZE = 100;
export const SOURCE_PAGE_SIZE = 1000;

export function normalizeOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

export function assertDifferentHosts(sourceUrl, targetUrl) {
  const sourceHost = new URL(sourceUrl).hostname.toLowerCase();
  const targetHost = new URL(targetUrl).hostname.toLowerCase();
  if (sourceHost === targetHost) {
    throw new Error(
      `Refusing to seed: source and target Supabase hosts are identical (${sourceHost}).`,
    );
  }
}

export function toLocalCaseRow(sourceRow) {
  return Object.fromEntries(
    CASE_COLUMNS.filter((column) => Object.hasOwn(sourceRow, column)).map((column) => [
      column,
      sourceRow[column],
    ]),
  );
}

export function chunkRows(rows, size = SEED_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export async function fetchPublishedCases(sourceClient) {
  const rows = [];
  for (let offset = 0; ; offset += SOURCE_PAGE_SIZE) {
    const { data, error } = await sourceClient
      .from("cases")
      .select(CASE_COLUMNS.join(","))
      .eq("is_published", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + SOURCE_PAGE_SIZE - 1);
    if (error) throw new Error(`Reading production cases failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < SOURCE_PAGE_SIZE) return rows;
  }
}

export async function upsertCases(targetClient, rows) {
  for (const batch of chunkRows(rows)) {
    const { error } = await targetClient.from("cases").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`Writing local cases failed: ${error.message}`);
  }
}

