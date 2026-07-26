import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSupabaseClient } from "@/lib/supabase/auth-server-client";
import {
  isSharedOperatorConfigured,
  normalizeOperatorNextPath,
  OPERATOR_SESSION_COOKIE,
  verifySharedOperatorSession,
} from "@/lib/operator/shared-session";

export type OperatorIdentity = {
  id: string;
  email: string | null;
};

export function isConfiguredOperator(userId: string | null | undefined) {
  const configuredId = process.env.GOODCASE_OPERATOR_USER_ID?.trim();
  return Boolean(configuredId && userId && configuredId === userId);
}

export async function getOperatorIdentity(): Promise<OperatorIdentity | null> {
  const sharedPassword = process.env.GOODCASE_OPERATOR_PASSWORD;
  const sessionSecret = process.env.GOODCASE_OPERATOR_SESSION_SECRET;

  if (isSharedOperatorConfigured(sharedPassword, sessionSecret)) {
    const cookieStore = await cookies();
    const token = cookieStore.get(OPERATOR_SESSION_COOKIE)?.value;
    if (verifySharedOperatorSession(token, sessionSecret!)) {
      return {
        id: "operator-team",
        email: "GoodCase 团队",
      };
    }
  }

  const supabase = await getAuthSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isConfiguredOperator(user.id)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function requireOperatorIdentity(nextPath = "/operator") {
  const operator = await getOperatorIdentity();
  if (!operator) {
    const next = normalizeOperatorNextPath(nextPath);
    redirect(`/operator/login?next=${encodeURIComponent(next)}`);
  }
  return operator;
}
