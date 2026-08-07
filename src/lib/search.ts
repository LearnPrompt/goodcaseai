export type SearchField = {
  value?: string | null;
  weight: number;
  key: string;
};

export type SearchMatch = {
  score: number;
  field: string;
  text: string;
};

type HighlightPart = {
  text: string;
  matched: boolean;
};

function normalizeText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function queryTokens(query: string) {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function countOccurrences(value: string, token: string) {
  if (!token) return 0;
  let count = 0;
  let start = 0;
  while (start < value.length) {
    const index = value.indexOf(token, start);
    if (index < 0) break;
    count += 1;
    start = index + token.length;
  }
  return count;
}

type FieldScore = {
  field: string;
  text: string;
  score: number;
  tokenMatches: string[];
  fullCoverage: boolean;
};

/**
 * 单字段打分，不做「必须全部 token 命中」的门槛判断——门槛判断挪到结果级
 * （见 getSearchMatch），这里只负责：这个字段命中了多少、分数多高、是否
 * 自己就覆盖了全部 token（fullCoverage，用来判断能不能单独作为展示字段）。
 */
function scoreField(value: string, normalizedQuery: string, tokens: string[], weight: number): FieldScore {
  const normalizedValue = normalizeText(value);
  const phraseMatch = normalizedValue.includes(normalizedQuery);
  const tokenMatches = tokens.filter((token) => normalizedValue.includes(token));

  if (!phraseMatch && tokenMatches.length === 0) {
    return { field: "", text: value, score: 0, tokenMatches, fullCoverage: false };
  }

  const exactPhraseBonus = phraseMatch ? 70 : 0;
  const startsWithBonus = normalizedValue.startsWith(normalizedQuery) ? 24 : 0;
  const frequencyBonus = tokenMatches.reduce(
    (total, token) => total + Math.min(countOccurrences(normalizedValue, token), 3) * 4,
    0
  );
  const score = weight + exactPhraseBonus + startsWithBonus + tokenMatches.length * 16 + frequencyBonus;
  const fullCoverage = phraseMatch || tokenMatches.length === tokens.length;

  return { field: "", text: value, score, tokenMatches, fullCoverage };
}

/**
 * 返回一个结果最有价值的命中字段。字段权重让标题/作者优先于长 Prompt，
 * 但 Prompt 仍然可以把真实证据搜出来。
 *
 * 命中判定是结果级的：多词查询里，每个 token 只要在任意一个可搜字段命中即可
 * （例如「模型」在 model 字段命中、「主题」在 title 字段命中），只要全部 token
 * 都在某个字段里找到了归属，这条记录就算命中——不再要求所有 token 挤进同一个
 * 字段。字段自身的打分和「是否自己就覆盖了全部 token」仍然分开算，用来挑
 * 展示字段：优先选单字段就命中全部 token 的（更精确、更适合做高亮片段），
 * 都没有这种字段时，退化为按分数最高的部分命中字段展示。
 */
export function getSearchMatch(
  fields: SearchField[],
  query: string
): SearchMatch | null {
  const normalizedQuery = normalizeText(query);
  const tokens = queryTokens(query);
  if (!normalizedQuery || tokens.length === 0) return null;

  const fieldScores = fields
    .filter((field): field is SearchField & { value: string } => Boolean(field.value?.trim()))
    .map((field) => ({
      ...scoreField(field.value, normalizedQuery, tokens, field.weight),
      field: field.key,
    }));

  // 结果级判定：全部 token 是否都在某个字段里找到了归属（跨字段并集）。
  const coveredTokens = new Set<string>();
  for (const entry of fieldScores) {
    for (const token of entry.tokenMatches) coveredTokens.add(token);
  }
  if (coveredTokens.size !== tokens.length) return null;

  const hits = fieldScores.filter((entry) => entry.score > 0);
  const fullCoverageHits = hits.filter((entry) => entry.fullCoverage);
  const pool = fullCoverageHits.length > 0 ? fullCoverageHits : hits;

  const best = pool.sort((a, b) => b.score - a.score || a.field.localeCompare(b.field))[0];
  return best ? { field: best.field, text: best.text, score: best.score } : null;
}

export function rankSearchResults<T>(
  list: T[],
  query: string,
  getFields: (item: T) => SearchField[]
) {
  if (!query.trim()) {
    return list.map((item) => ({ item, match: null }));
  }

  return list
    .map((item, index) => ({ item, match: getSearchMatch(getFields(item), query), index }))
    .filter((result): result is { item: T; match: SearchMatch; index: number } => result.match !== null)
    .sort((a, b) => b.match.score - a.match.score || a.index - b.index);
}

/** 取带命中的短片段，避免搜索 Prompt 时卡片仍然只显示泛化摘要。 */
export function getSearchSnippet(match: SearchMatch, query: string, maxLength = 150) {
  const text = match.text.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const normalizedText = normalizeText(text);
  const tokens = [normalizeText(query), ...queryTokens(query)].filter(Boolean);
  const hitIndex = tokens
    .map((token) => normalizedText.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const context = Math.max(24, Math.floor((maxLength - 2) / 2));
  const start = Math.max(0, hitIndex - context);
  const end = Math.min(text.length, start + maxLength - 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function splitHighlightedText(text: string, query: string): HighlightPart[] {
  const tokens = queryTokens(query).sort((a, b) => b.length - a.length);
  if (!text || tokens.length === 0) return [{ text, matched: false }];

  const phrase = normalizeText(query);
  const patterns = [phrase, ...tokens].filter(
    (value, index, values) => values.indexOf(value) === index
  );
  const pattern = new RegExp(`(${patterns.map(escapeRegExp).join("|")})`, "giu");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      matched: patterns.some((token) => normalizeText(part) === token),
    }));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
