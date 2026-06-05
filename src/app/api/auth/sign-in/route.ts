import { type NextRequest } from "next/server";
import { mapAuthUser } from "@/lib/auth/auth-user";
import { createAuthRouteClient } from "@/lib/supabase/route-client";

type AuthRequestBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
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

  if (!email || !password) {
    return client.json({ error: "请填写邮箱和密码。" }, { status: 400 });
  }

  try {
    const { data, error } = await client.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return client.json({ error: error.message }, { status: 400 });
    }

    if (name && data.user) {
      const currentName =
        typeof data.user.user_metadata?.display_name === "string"
          ? data.user.user_metadata.display_name.trim()
          : "";

      if (!currentName || currentName !== name) {
        await client.supabase.auth.updateUser({
          data: { display_name: name },
        });
      }
    }

    return client.json({ user: mapAuthUser(data.user) });
  } catch {
    return client.json(
      { error: "认证服务暂时不可用，请稍后重试。" },
      { status: 503 }
    );
  }
}
