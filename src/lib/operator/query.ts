export const CANDIDATE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "published",
] as const;

export const CANDIDATE_CATEGORIES = [
  "all",
  "image",
  "video",
  "web",
  "copy",
  "hardware",
] as const;

export const CANDIDATE_ORIGINS = ["all", "web", "import"] as const;
export const FEEDBACK_STATUSES = ["open", "resolved", "archived"] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
export type CandidateCategory = (typeof CANDIDATE_CATEGORIES)[number];
export type CandidateOrigin = (typeof CANDIDATE_ORIGINS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type OperatorView = "candidates" | "feedback";

export type OperatorQuery = {
  view: OperatorView;
  status: CandidateStatus;
  feedbackStatus: FeedbackStatus;
  category: CandidateCategory;
  origin: CandidateOrigin;
  query: string;
  page: number;
  candidateId: string | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  return value && allowed.includes(value) ? (value as T[number]) : fallback;
}

export function normalizeOperatorSearch(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseOperatorQuery(raw: RawSearchParams): OperatorQuery {
  const rawPage = Number.parseInt(first(raw.page) ?? "1", 10);
  const rawCandidateId = first(raw.candidate);

  return {
    view: first(raw.view) === "feedback" ? "feedback" : "candidates",
    status: oneOf(first(raw.status), CANDIDATE_STATUSES, "pending"),
    feedbackStatus: oneOf(
      first(raw.feedbackStatus),
      FEEDBACK_STATUSES,
      "open"
    ),
    category: oneOf(first(raw.category), CANDIDATE_CATEGORIES, "all"),
    origin: oneOf(first(raw.origin), CANDIDATE_ORIGINS, "all"),
    query: normalizeOperatorSearch(first(raw.q)),
    page:
      Number.isFinite(rawPage) && rawPage > 0
        ? Math.min(rawPage, 10_000)
        : 1,
    candidateId:
      rawCandidateId && UUID_PATTERN.test(rawCandidateId)
        ? rawCandidateId
        : null,
  };
}

export function buildOperatorHref(
  query: OperatorQuery,
  changes: Partial<OperatorQuery> = {}
) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();

  if (next.view !== "candidates") params.set("view", next.view);
  if (next.status !== "pending") params.set("status", next.status);
  if (next.feedbackStatus !== "open") {
    params.set("feedbackStatus", next.feedbackStatus);
  }
  if (next.category !== "all") params.set("category", next.category);
  if (next.origin !== "all") params.set("origin", next.origin);
  if (next.query) params.set("q", next.query);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.candidateId) params.set("candidate", next.candidateId);

  const encoded = params.toString();
  return encoded ? `/operator?${encoded}` : "/operator";
}
