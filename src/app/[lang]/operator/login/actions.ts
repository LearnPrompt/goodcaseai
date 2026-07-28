"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSharedOperatorSession,
  isSharedOperatorConfigured,
  normalizeOperatorNextPath,
  OPERATOR_SESSION_COOKIE,
  OPERATOR_SESSION_MAX_AGE_SECONDS,
  verifySharedOperatorPassword,
} from "@/lib/operator/shared-session";
import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

function readPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.slice(0, 256) : "";
}

async function loginFingerprint() {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function loginOperatorWithPassword(formData: FormData) {
  const password = readPassword(formData.get("password"));
  const next = normalizeOperatorNextPath(formData.get("next"));
  const loginPath = next.startsWith("/en/") ? "/en/operator/login" : "/operator/login";
  const configuredPassword = process.env.GOODCASE_OPERATOR_PASSWORD;
  const sessionSecret = process.env.GOODCASE_OPERATOR_SESSION_SECRET;
  const admin = getAdminSupabaseClient();

  if (
    !isSharedOperatorConfigured(configuredPassword, sessionSecret) ||
    !admin
  ) {
    redirect(
      `${loginPath}?error=unavailable&next=${encodeURIComponent(next)}`
    );
  }

  const fingerprint = await loginFingerprint();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "operator_login_failed")
    .eq("anonymous_session_id", fingerprint)
    .gt("created_at", windowStart);

  if (countError) {
    redirect(
      `${loginPath}?error=unavailable&next=${encodeURIComponent(next)}`
    );
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    redirect(`${loginPath}?error=locked&next=${encodeURIComponent(next)}`);
  }

  if (!verifySharedOperatorPassword(password, configuredPassword!)) {
    await admin.from("analytics_events").insert({
      event_name: "operator_login_failed",
      path: "/operator/login",
      anonymous_session_id: fingerprint,
      properties: { authMode: "shared-password" },
    });
    redirect(`${loginPath}?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    OPERATOR_SESSION_COOKIE,
    createSharedOperatorSession(sessionSecret!),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OPERATOR_SESSION_MAX_AGE_SECONDS,
    }
  );

  redirect(next);
}
