import { type NextRequest } from "next/server";
import { buildAuthCallbackUrl } from "@/lib/auth/next-path";
import { mapAuthUser } from "@/lib/auth/auth-user";
import {
  createAuthRouteClient,
  getAuthRedirectOrigin,
} from "@/lib/supabase/route-client";

type AuthRequestBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  nextUrl?: unknown;
};

async function readAuthBody(request: NextRequest): Promise<AuthRequestBody> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const client = createAuthRouteClient(request);

  if (!client) {
    return Response.json({ error: "请先配置 Supabase 环境变量。" }, { status: 500 });
  }

  const body = await readAuthBody(request);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nextUrl = typeof body.nextUrl === "string" ? body.nextUrl : undefined;

  if (!email || !password) {
    return client.json({ error: "请填写邮箱和密码。" }, { status: 400 });
  }

  try {
    const { data, error } = await client.supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { display_name: name } : undefined,
        emailRedirectTo: buildAuthCallbackUrl(getAuthRedirectOrigin(request), nextUrl),
      },
    });

    if (error) {
      return client.json({ error: error.message }, { status: 400 });
    }

    return client.json({
      user: mapAuthUser(data.user),
      needsEmailConfirm: !data.session,
    });
  } catch {
    return client.json(
      { error: "认证服务暂时不可用，请稍后重试。" },
      { status: 503 }
    );
  }
}
