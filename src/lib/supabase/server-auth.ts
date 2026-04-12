import { cache } from "react";
import { mapAuthUser } from "@/lib/auth/auth-user";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";

export const getServerAuthUser = cache(async () => {
  const supabase = await getServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return mapAuthUser(user);
});
