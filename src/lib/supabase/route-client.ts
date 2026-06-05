import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type AuthRouteClient = {
  supabase: ReturnType<typeof createServerClient>;
  json: (body: unknown, init?: ResponseInit) => NextResponse;
};

export function createAuthRouteClient(request: NextRequest): AuthRouteClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders = new Headers();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });

        Object.entries(headers).forEach(([key, value]) => {
          pendingHeaders.set(key, value);
        });
      },
    },
  });

  return {
    supabase,
    json(body, init) {
      const response = NextResponse.json(body, init);

      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });

      pendingHeaders.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    },
  };
}

export function getAuthRedirectOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    requestUrl.host;
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocalHost
    ? requestUrl.protocol.replace(":", "") || "http"
    : "https";

  return `${protocol}://${host}`;
}
