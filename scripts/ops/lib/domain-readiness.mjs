export const DEFAULT_TARGET_ORIGIN = "https://goodcase.carlwow.com";
export const DEFAULT_LEGACY_ORIGIN = "https://goodcase.ai";
export const DEFAULT_EXPECTED_IPV4 = "76.76.21.21";
export const DEFAULT_STABLE_HOURS = 24;

export const TARGET_HTTP_CHECKS = [
  { id: "home", path: "/", contentType: "text/html" },
  { id: "cases", path: "/cases", contentType: "text/html" },
  { id: "creators", path: "/creators", contentType: "text/html" },
  { id: "submit", path: "/submit", contentType: "text/html" },
  { id: "feedback", path: "/connect#feedback", contentType: "text/html" },
  {
    id: "public_api",
    path: "/api/public/cases?take=1",
    contentType: "application/json",
  },
  { id: "rss", path: "/feed.xml", contentType: "xml" },
  { id: "sitemap", path: "/sitemap.xml", contentType: "xml" },
  { id: "robots", path: "/robots.txt", contentType: "text/plain" },
];

export const WECHAT_UA_PATHS = ["/", "/cases", "/submit", "/connect"];

export function normalizeOrigin(value, fallback) {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return fallback;
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

function parseBooleanFlag(argv, flag) {
  return argv.includes(`--${flag}`);
}

function parseValueFlag(argv, flag, fallback) {
  const prefix = `--${flag}=`;
  const match = argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

export function parseArgs(argv) {
  const phase = parseValueFlag(argv, "phase", "pre-301");
  if (phase !== "pre-301" && phase !== "post-301") {
    throw new Error("--phase must be pre-301 or post-301");
  }

  const timeoutMs = Number.parseInt(
    parseValueFlag(argv, "timeout-ms", "12000"),
    10
  );
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error("--timeout-ms must be at least 1000");
  }

  const stableHours = Number.parseInt(
    parseValueFlag(
      argv,
      "required-stable-hours",
      String(DEFAULT_STABLE_HOURS)
    ),
    10
  );
  if (!Number.isFinite(stableHours) || stableHours < 24) {
    throw new Error("--required-stable-hours must be at least 24");
  }

  return {
    targetOrigin: normalizeOrigin(
      parseValueFlag(argv, "target-origin", DEFAULT_TARGET_ORIGIN),
      DEFAULT_TARGET_ORIGIN
    ),
    legacyOrigin: normalizeOrigin(
      parseValueFlag(argv, "legacy-origin", DEFAULT_LEGACY_ORIGIN),
      DEFAULT_LEGACY_ORIGIN
    ),
    expectedIpv4: parseValueFlag(
      argv,
      "expected-ip",
      DEFAULT_EXPECTED_IPV4
    ),
    stableSince: parseValueFlag(argv, "stable-since", ""),
    requiredStableHours: stableHours,
    filingApproved: parseBooleanFlag(argv, "filing-approved"),
    wechatRealDevicePassed: parseBooleanFlag(
      argv,
      "wechat-real-device-passed"
    ),
    json: parseBooleanFlag(argv, "json"),
    phase,
    timeoutMs,
  };
}

export function stableObservation(stableSince, nowMs, requiredHours) {
  if (!stableSince) {
    return {
      ok: false,
      hours: 0,
      reason: "missing --stable-since",
    };
  }

  const startedAt = Date.parse(stableSince);
  if (!Number.isFinite(startedAt) || startedAt > nowMs) {
    return {
      ok: false,
      hours: 0,
      reason: "invalid --stable-since",
    };
  }

  const hours = (nowMs - startedAt) / (60 * 60 * 1000);
  return {
    ok: hours >= requiredHours,
    hours,
    reason:
      hours >= requiredHours
        ? `${hours.toFixed(1)}h observed`
        : `${hours.toFixed(1)}h / ${requiredHours}h observed`,
  };
}

export function isExpectedLegacyRedirect({
  legacyUrl,
  location,
  targetOrigin,
}) {
  if (!location) {
    return false;
  }

  try {
    const source = new URL(legacyUrl);
    const destination = new URL(location, source);
    const expected = new URL(`${source.pathname}${source.search}`, targetOrigin);
    return destination.toString() === expected.toString();
  } catch {
    return false;
  }
}

export function evaluateReadiness({
  dnsOk,
  targetHttpOk,
  wechatUaHttpOk,
  filingApproved,
  wechatRealDevicePassed,
  stableObservationOk,
  phase,
  legacyRedirectOk,
}) {
  const checks = {
    dns: dnsOk,
    target_http: targetHttpOk,
    wechat_ua_http: wechatUaHttpOk,
    filing_approved: filingApproved,
    wechat_real_device: wechatRealDevicePassed,
    stable_observation: stableObservationOk,
  };

  if (phase === "post-301") {
    checks.legacy_301 = legacyRedirectOk;
  }

  const blockers = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  return {
    ready: blockers.length === 0,
    blockers,
    checks,
  };
}
