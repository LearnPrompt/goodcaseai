import { type NextRequest } from "next/server";
import { createAuthRouteClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  const client = createAuthRouteClient(request);

  if (!client) {
    return Response.json({ error: "请先配置 Supabase 环境变量。" }, { status: 500 });
  }

  try {
    const { error } = await client.supabase.auth.signOut();

    if (error) {
      return client.json({ error: error.message }, { status: 400 });
    }

    return client.json({ user: null });
  } catch {
    return client.json(
      { error: "认证服务暂时不可用，请稍后重试。" },
      { status: 503 }
    );
  }
}
