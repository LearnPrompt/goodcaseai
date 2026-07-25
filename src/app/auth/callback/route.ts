import { NextResponse, type NextRequest } from "next/server";
import { isConfiguredOperator } from "@/lib/operator/auth";
import { getAuthSupabaseClient } from "@/lib/supabase/auth-server-client";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/operator", request.url);
  const login = new URL("/operator/login", request.url);

  if (!code) {
    login.searchParams.set("error", "callback");
    return NextResponse.redirect(login);
  }

  const supabase = await getAuthSupabaseClient();
  if (!supabase) {
    login.searchParams.set("error", "unavailable");
    return NextResponse.redirect(login);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    login.searchParams.set("error", "callback");
    return NextResponse.redirect(login);
  }

  if (!isConfiguredOperator(data.user.id)) {
    await supabase.auth.signOut();
    login.searchParams.set("error", "forbidden");
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(destination);
}
