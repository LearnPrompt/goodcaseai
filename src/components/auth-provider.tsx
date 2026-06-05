"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@/lib/auth/auth-user";

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

type AuthApiResponse = {
  user?: AuthUser | null;
  error?: string;
  needsEmailConfirm?: boolean;
};

async function postAuth(path: string, body?: AuthPayload): Promise<AuthApiResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as AuthApiResponse;

  if (!response.ok) {
    return {
      error: payload.error || "认证请求失败，请稍后重试。",
    };
  }

  return payload;
}

function getConfiguredAuthCore({
  setUser,
}: {
  setUser: (value: AuthUser | null) => void;
}): AuthCore {
  return {
    async signIn(payload) {
      const result = await postAuth("/api/auth/sign-in", payload);

      if (result.error) {
        return { error: result.error, needsEmailConfirm: false };
      }

      setUser(result.user || null);

      return { error: null, needsEmailConfirm: false };
    },
    async signUp(payload) {
      const result = await postAuth("/api/auth/sign-up", payload);

      if (result.error) {
        return { error: result.error, needsEmailConfirm: false };
      }

      if (result.user && !result.needsEmailConfirm) {
        setUser(result.user);
      }

      return {
        error: null,
        needsEmailConfirm: Boolean(result.needsEmailConfirm),
      };
    },
    async signOut() {
      const result = await postAuth("/api/auth/sign-out");
      if (result.error) {
        return { error: result.error };
      }

      setUser(null);
      return { error: null };
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    let isActive = true;

    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          isConfigured?: boolean;
          user?: AuthUser | null;
        };

        if (!isActive) {
          return;
        }

        setIsConfigured(payload.isConfigured !== false);
        setUser(payload.user || null);
        setIsReady(true);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setUser(null);
        setIsReady(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const authCore = useMemo<AuthCore>(
    () =>
      isConfigured
        ? getConfiguredAuthCore({ setUser })
        : getUnconfiguredAuthCore(setUser),
    [isConfigured]
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
