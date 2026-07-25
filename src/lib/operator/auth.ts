import "server-only";

import { redirect } from "next/navigation";
import { getAuthSupabaseClient } from "@/lib/supabase/auth-server-client";

export type OperatorIdentity = {
  id: string;
  email: string | null;
};

export function isConfiguredOperator(userId: string | null | undefined) {
  const configuredId = process.env.GOODCASE_OPERATOR_USER_ID?.trim();
  return Boolean(configuredId && userId && configuredId === userId);
}

export async function getOperatorIdentity(): Promise<OperatorIdentity | null> {
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

export async function requireOperatorIdentity() {
  const operator = await getOperatorIdentity();
  if (!operator) {
    redirect("/operator/login");
  }
  return operator;
}
