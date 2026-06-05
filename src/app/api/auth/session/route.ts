import { type NextRequest } from "next/server";
import { mapAuthUser } from "@/lib/auth/auth-user";
import { createAuthRouteClient } from "@/lib/supabase/route-client";

export async function GET(request: NextRequest) {
  const client = createAuthRouteClient(request);

  if (!client) {
    return Response.json({ isConfigured: false, user: null });
  }

  try {
    const {
      data: { user },
    } = await client.supabase.auth.getUser();

    return client.json({ isConfigured: true, user: mapAuthUser(user) });
  } catch {
    return client.json(
      { isConfigured: true, user: null, error: "认证服务暂时不可用，请稍后重试。" },
      { status: 503 }
    );
  }
}
