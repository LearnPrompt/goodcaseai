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

function scoreField(value: string, query: string, tokens: string[], weight: number) {
  const normalizedValue = normalizeText(value);
  const normalizedQuery = normalizeText(query);
  const phraseMatch = normalizedValue.includes(normalizedQuery);
  const tokenMatches = tokens.filter((token) => normalizedValue.includes(token));

  // 多词查询要求全部词命中；单词查询保持普通 substring 搜索习惯。
  if (!phraseMatch && tokenMatches.length !== tokens.length) {
    return 0;
  }

  const exactPhraseBonus = phraseMatch ? 70 : 0;
  const startsWithBonus = normalizedValue.startsWith(normalizedQuery) ? 24 : 0;
  const frequencyBonus = tokenMatches.reduce(
    (total, token) => total + Math.min(countOccurrences(normalizedValue, token), 3) * 4,
    0
  );

  return weight + exactPhraseBonus + startsWithBonus + tokenMatches.length * 16 + frequencyBonus;
}

/**
 * 返回一个结果最有价值的命中字段。字段权重让标题/作者优先于长 Prompt，
 * 但 Prompt 仍然可以把真实证据搜出来。
 */
export function getSearchMatch(
  fields: SearchField[],
  query: string
): SearchMatch | null {
  const normalizedQuery = normalizeText(query);
  const tokens = queryTokens(query);
  if (!normalizedQuery || tokens.length === 0) return null;

  return fields
    .filter((field): field is SearchField & { value: string } => Boolean(field.value?.trim()))
    .map((field) => ({
      field: field.key,
      text: field.value,
      score: scoreField(field.value, normalizedQuery, tokens, field.weight),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.field.localeCompare(b.field))[0] || null;
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
