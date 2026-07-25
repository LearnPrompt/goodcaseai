const BLOCKED_TERMS = [
  "nsfw",
  "nude",
  "naked",
  "porn",
  "sex",
  "lingerie",
  "bikini",
  "minor",
  "underage",
  "celebrity",
  "deepfake",
  "face swap",
  "faceswap",
  "disney",
  "marvel",
  "minecraft",
  "minion",
  "pokemon",
  "mario",
  "luigi",
  "nintendo",
  "yoshi",
  "sonic",
  "spongebob",
  "kendrick lamar",
  "year old",
  "jedi",
  "star wars",
  "dracula",
  "style of",
  "batman",
  "superman",
  "iphone",
  "nike",
  "adidas",
  "coca-cola",
  "telegram",
  "youtube",
  "rei ayanami",
  "bob ross",
];

export function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

export function stripHtml(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|li|h[1-6]|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractMeta(html, key, { property = false } = {}) {
  const attribute = property ? "property" : "name";
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*${attribute}=["']${escapedKey}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta\\b[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escapedKey}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return decodeHtml(match[1]).trim();
    }
  }
  return "";
}

export function extractJsonScript(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<script\\b[^>]*id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/script>`,
      "i"
    )
  );
  if (!match) {
    return null;
  }
  return JSON.parse(decodeHtml(match[1]));
}

export function extractBalancedJsonValue(text, startIndex) {
  const opening = text[startIndex];
  if (opening !== "[" && opening !== "{") {
    return "";
  }
  const closing = opening === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === opening) {
      depth += 1;
    } else if (character === closing) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }
  return "";
}

export function extractNextFlightText(html) {
  const chunks = [];
  const scripts = html.matchAll(
    /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g
  );
  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1]);
      if (typeof payload[1] === "string") {
        chunks.push(payload[1]);
      }
    } catch {
      // Ignore unrelated or partially streamed chunks.
    }
  }
  return chunks.join("");
}

export function extractIdeogramGalleryItems(html) {
  const items = [];
  const tags = html.matchAll(
    /<div\b[^>]*class=["'][^"']*\bblog-gallery-item\b[^"']*["'][^>]*>/gi
  );
  for (const match of tags) {
    const tag = match[0];
    const attribute = (name) => {
      const value = tag.match(
        new RegExp(`${name}=["']([\\s\\S]*?)["']`, "i")
      )?.[1];
      return decodeHtml(value || "").trim();
    };
    const prompt = attribute("data-prompt");
    const sourceUrl = attribute("data-link");
    const mediaUrl = attribute("data-fullsize");
    if (prompt && sourceUrl && mediaUrl) {
      items.push({ prompt, sourceUrl, mediaUrl });
    }
  }
  return items;
}

export function hasBlockedTerms(value) {
  const normalized = String(value ?? "").toLowerCase();
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

export function evidenceChecks(item) {
  const promptLength = String(item.promptText ?? "").trim().length;
  const methodLength = String(item.method ?? "").trim().length;
  return {
    source: Boolean(item.sourceUrl),
    author: Boolean(item.creator && item.creator !== "未知作者"),
    result: Boolean(item.mediaUrl),
    method: promptLength >= 20 || methodLength >= 120,
    license: Boolean(
      item.license &&
        !item.license.includes("未知") &&
        !item.license.includes("未明确") &&
        !item.license.includes("待复核")
    ),
  };
}

export function classifySample(item) {
  const checks = evidenceChecks(item);
  const coreChecks = ["source", "author", "result", "method"];
  const passed = coreChecks.filter((key) => checks[key]).length;
  return {
    ...item,
    checks,
    completeness: passed / coreChecks.length,
    candidateType: passed === coreChecks.length ? "case" : "topic_seed",
  };
}
