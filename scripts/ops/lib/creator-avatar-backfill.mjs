const RESERVED_X_PATHS = new Set([
  "compose",
  "explore",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "search",
  "settings",
]);

export function normalizeCreatorKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/^@(?=[a-z0-9_])/i, "")
    .toLowerCase();
}

export function extractXHandle(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts.length < 3 ||
      parts[1].toLowerCase() !== "status" ||
      RESERVED_X_PATHS.has(parts[0].toLowerCase())
    ) {
      return null;
    }
    return /^[a-z0-9_]{1,15}$/i.test(parts[0]) ? parts[0] : null;
  } catch {
    return null;
  }
}

export function extractXTweetId(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts.length < 3 ||
      parts[1].toLowerCase() !== "status" ||
      !/^\d{5,30}$/.test(parts[2])
    ) {
      return null;
    }
    return parts[2];
  } catch {
    return null;
  }
}

export function normalizeXAvatarUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "pbs.twimg.com" ||
      !url.pathname.startsWith("/profile_images/")
    ) {
      return null;
    }
    url.pathname = url.pathname.replace(
      /_normal(\.(?:jpe?g|png|webp))$/i,
      "_400x400$1"
    );
    return url.toString();
  } catch {
    return null;
  }
}

export function buildCreatorAvatarPlan(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const creatorName = String(row.creator_name || "").trim();
    const creatorKey = normalizeCreatorKey(creatorName);
    if (!creatorKey) {
      continue;
    }
    const existing = grouped.get(creatorKey) || {
      creatorKey,
      creatorName,
      caseIds: [],
      handles: new Set(),
      tweetIds: new Set(),
      avatarUrls: new Set(),
    };
    existing.caseIds.push(row.id);
    const handle = extractXHandle(row.source_url);
    if (handle) {
      existing.handles.add(handle.toLowerCase());
    }
    const tweetId = extractXTweetId(row.source_url);
    if (tweetId) {
      existing.tweetIds.add(tweetId);
    }
    if (row.creator_avatar_url) {
      existing.avatarUrls.add(row.creator_avatar_url);
    }
    grouped.set(creatorKey, existing);
  }

  const groups = [...grouped.values()]
    .map((item) => {
      const handles = [...item.handles];
      const tweetIds = [...item.tweetIds];
      const avatarUrls = [...item.avatarUrls];
      const status =
        avatarUrls.length > 0
          ? "covered"
          : tweetIds.length > 0
            ? "resolvable"
            : "unresolvable";
      return {
        creatorKey: item.creatorKey,
        creatorName: item.creatorName,
        caseIds: item.caseIds,
        handles,
        tweetIds,
        avatarUrls,
        status,
      };
    })
    .sort((a, b) => a.creatorName.localeCompare(b.creatorName));

  return {
    groups,
    counts: {
      creators: groups.length,
      covered: groups.filter((item) => item.status === "covered").length,
      resolvable: groups.filter((item) => item.status === "resolvable").length,
      unresolvable: groups.filter((item) => item.status === "unresolvable")
        .length,
    },
  };
}
