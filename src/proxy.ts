import { type NextRequest, NextResponse } from "next/server";

const LEGACY_HOST = "goodcase.ai";

function getCanonicalOrigin() {
  const raw = process.env.GOODCASE_CANONICAL_ORIGIN;
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/project-intro") {
    return NextResponse.redirect(new URL("/connect#about", request.url), 301);
  }

  const enabled = process.env.GOODCASE_ENABLE_LEGACY_REDIRECT === "true";
  const canonicalOrigin = getCanonicalOrigin();
  const requestHost = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (!enabled || !canonicalOrigin || requestHost !== LEGACY_HOST) {
    return NextResponse.next();
  }

  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    canonicalOrigin
  );
  return NextResponse.redirect(destination, 301);
}

export const config = {
  matcher: "/:path*",
};
