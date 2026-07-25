"use server";

import { redirect } from "next/navigation";
import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import { getAuthSupabaseClient } from "@/lib/supabase/auth-server-client";
import { absoluteUrl } from "@/lib/site";

function cleanEmail(value: FormDataEntryValue | null) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

export async function requestOperatorMagicLink(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const operatorId = process.env.GOODCASE_OPERATOR_USER_ID?.trim();
  const admin = getAdminSupabaseClient();
  const auth = await getAuthSupabaseClient();

  if (!email || !operatorId || !admin || !auth) {
    redirect("/operator/login?error=unavailable");
  }

  const { data: operator, error: operatorError } =
    await admin.auth.admin.getUserById(operatorId);

  if (
    operatorError ||
    !operator.user.email ||
    operator.user.email.toLowerCase() !== email
  ) {
    redirect("/operator/login?sent=1");
  }

  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: absoluteUrl("/auth/callback?next=/operator"),
    },
  });

  if (error) {
    redirect("/operator/login?error=send");
  }

  redirect("/operator/login?sent=1");
}
