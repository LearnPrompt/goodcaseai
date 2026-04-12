"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { buildAuthCallbackUrl } from "@/lib/auth/next-path";
import { mapAuthUser, type AuthUser } from "@/lib/auth/auth-user";

type AuthPayload = {
  email: string;
  password: string;
  name?: string;
  nextUrl?: string;
};

type AuthResult = {
  error: string | null;
  needsEmailConfirm: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  isConfigured: boolean;
  signIn: (payload: AuthPayload) => Promise<AuthResult>;
  signUp: (payload: AuthPayload) => Promise<AuthResult>;
  signOut: () => Promise<{ error: string | null }>;
};

type AuthCore = {
  signIn: (payload: AuthPayload) => Promise<AuthResult>;
  signUp: (payload: AuthPayload) => Promise<AuthResult>;
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildEmailRedirect(nextUrl?: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return buildAuthCallbackUrl(window.location.origin, nextUrl);
}

function getUnconfiguredAuthCore(setUser: (value: AuthUser | null) => void): AuthCore {
  return {
    async signIn() {
      return {
        error: "请先配置 Supabase 环境变量后再登录。",
        needsEmailConfirm: false,
      };
    },
    async signUp() {
      return {
        error: "请先配置 Supabase 环境变量后再注册。",
        needsEmailConfirm: false,
      };
    },
    async signOut() {
      setUser(null);
      return { error: null };
    },
  };
}

function getConfiguredAuthCore({
  supabase,
  setUser,
}: {
  supabase: SupabaseClient;
  setUser: (value: AuthUser | null) => void;
}): AuthCore {
  return {
    async signIn(payload) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (error) {
        return { error: error.message, needsEmailConfirm: false };
      }

      if (payload.name && data.user) {
        const currentName =
          typeof data.user.user_metadata?.display_name === "string"
            ? data.user.user_metadata.display_name.trim()
            : "";
        if (!currentName || currentName !== payload.name.trim()) {
          await supabase.auth.updateUser({
            data: { display_name: payload.name.trim() },
          });
        }
      }

      return { error: null, needsEmailConfirm: false };
    },
    async signUp(payload) {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: payload.name ? { display_name: payload.name.trim() } : undefined,
          emailRedirectTo: buildEmailRedirect(payload.nextUrl),
        },
      });

      if (error) {
        return { error: error.message, needsEmailConfirm: false };
      }

      return {
        error: null,
        needsEmailConfirm: !data.session,
      };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message };
      }

      setUser(null);
      return { error: null };
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getBrowserSupabaseClient();
  const isConfigured = Boolean(supabase);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(!isConfigured);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) {
          return;
        }
        setUser(mapAuthUser(data.session?.user));
        setIsReady(true);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setUser(null);
        setIsReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }
      setUser(mapAuthUser(session?.user));
      setIsReady(true);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const authCore = useMemo<AuthCore>(
    () =>
      supabase
        ? getConfiguredAuthCore({ supabase, setUser })
        : getUnconfiguredAuthCore(setUser),
    [supabase]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isConfigured,
      signIn: authCore.signIn,
      signUp: authCore.signUp,
      signOut: authCore.signOut,
    }),
    [authCore, isConfigured, isReady, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
