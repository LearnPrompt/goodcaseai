const DEFAULT_NEXT_PATH = "/";

export function getSafeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const url = new URL(nextPath, "http://localhost");

    if (url.origin !== "http://localhost") {
      return DEFAULT_NEXT_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}` || DEFAULT_NEXT_PATH;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}

export function buildAuthCallbackUrl(origin: string, nextPath?: string | null) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", getSafeNextPath(nextPath));
  return url.toString();
}
