import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "si",
]);

function isTrackingParam(name) {
  return name.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(name.toLowerCase());
}

function normalizeXUrl(url) {
  const xHosts = new Set([
    "mobile.twitter.com",
    "twitter.com",
    "www.twitter.com",
    "www.x.com",
    "x.com",
  ]);

  if (!xHosts.has(url.hostname)) {
    return false;
  }

  const statusMatch = url.pathname.match(
    /^\/(?:[^/]+\/status|i\/web\/status|i\/status)\/(\d+)(?:\/.*)?$/
  );
  if (!statusMatch) {
    return false;
  }

  url.protocol = "https:";
  url.hostname = "x.com";
  url.port = "";
  url.pathname = `/i/status/${statusMatch[1]}`;
  url.search = "";
  return true;
}

export function canonicalizeUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (!normalizeXUrl(url)) {
    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParam(name)) {
        url.searchParams.delete(name);
      }
    }
    url.searchParams.sort();
  }

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function buildCanonicalKey(value) {
  const canonicalUrl = canonicalizeUrl(value);
  if (!canonicalUrl) {
    return null;
  }

  return createHash("sha256").update(canonicalUrl).digest("hex");
}
