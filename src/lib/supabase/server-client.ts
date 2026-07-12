import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 请求超时（毫秒）。
 * 本机访问 supabase.co 可能被墙（TLS 重置），@supabase/postgrest-js 自带重试，
 * 导致单次查询需 8 秒才返回 error。用 Promise.race 在应用层兜底：
 * 超时即视为 Supabase 不可用，快速 fallback 到 mock-data，
 * 保证 SSR 流式渲染不被阻塞、动态页面不卡在 loading 骨架屏、hydration 正常完成。
 */
export const SUPABASE_TIMEOUT_MS = 3_000;

let cachedClient: SupabaseClient | null | undefined;

export function getServerSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

/**
 * 带超时的 Promise wrapper：在 SUPABASE_TIMEOUT_MS 内没完成就 reject，
 * 让调用方的 fallback 逻辑快速生效。
 * 接受 PromiseLike 以兼容 Supabase query builder（thenable 但非 Promise）。
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number = SUPABASE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Supabase query timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
