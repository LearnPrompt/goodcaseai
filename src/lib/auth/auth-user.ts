import type { User } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export function mapAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user?.email) {
    return null;
  }

  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  const fallbackName = user.email.split("@")[0] || "用户";

  return {
    id: user.id,
    email: user.email,
    name: metadataName || fallbackName,
  };
}
