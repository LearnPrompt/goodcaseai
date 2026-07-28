export function normalizeCreatorIdentity(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/^@(?=[a-z0-9_])/i, "")
    .toLowerCase();
}

export function slugifyCreatorName(name: string) {
  const normalized = normalizeCreatorIdentity(name);
  const tokens: string[] = [];
  let needsSeparator = false;

  for (const character of normalized) {
    if (/[a-z0-9\u4e00-\u9fff]/.test(character)) {
      if (needsSeparator && tokens.length > 0 && tokens.at(-1) !== "-") {
        tokens.push("-");
      }
      tokens.push(character);
      needsSeparator = false;
      continue;
    }

    if (/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(character)) {
      if (tokens.length > 0 && tokens.at(-1) !== "-") {
        tokens.push("-");
      }
      tokens.push(`u${character.codePointAt(0)?.toString(36)}`);
      needsSeparator = true;
      continue;
    }

    needsSeparator = true;
  }

  return tokens.join("").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}
