"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function LoginForm({
  nextUrl,
  authError = false,
}: {
  nextUrl: string;
  authError?: boolean;
}) {
  const router = useRouter();
  const { isConfigured, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("carl@example.com");
  const [name, setName] = useState("Carl");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState(
    authError ? "邮箱确认回跳未完成登录，请重新登录一次。" : ""
  );
  const [hintText, setHintText] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorText("");
    setHintText("");

    const payload = {
      email: email.trim(),
      password,
      name: name.trim(),
      nextUrl,
    };

    const result =
      mode === "signin" ? await signIn(payload) : await signUp(payload);

    if (result.error) {
      setErrorText(result.error);
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup" && result.needsEmailConfirm) {
      setHintText("注册成功，请先去邮箱确认，再返回登录。");
      setMode("signin");
      setIsSubmitting(false);
      return;
    }

    router.push(nextUrl);
    setIsSubmitting(false);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="flex gap-2 rounded-full border border-[var(--line)] bg-white/50 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-full px-3 py-2 font-semibold transition ${
            mode === "signin"
              ? "bg-[var(--ink)] text-[var(--bg-strong)]"
              : "text-[var(--muted)]"
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full px-3 py-2 font-semibold transition ${
            mode === "signup"
              ? "bg-[var(--ink)] text-[var(--bg-strong)]"
              : "text-[var(--muted)]"
          }`}
        >
          注册
        </button>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        昵称
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 outline-none"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        邮箱
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 outline-none"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        密码
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 outline-none"
          placeholder="至少 6 位"
        />
      </label>

      {!isConfigured ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
          尚未配置 Supabase 环境变量，当前无法完成真实登录。
        </p>
      ) : null}

      {errorText ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--accent)]">
          {errorText}
        </p>
      ) : null}

      {hintText ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
          {hintText}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !isConfigured}
        className="mt-2 min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--bg-strong)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "提交中..."
          : mode === "signin"
            ? "登录并返回"
            : "注册并继续"}
      </button>
    </form>
  );
}
