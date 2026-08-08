import { projectRefFromUrl } from "../../ops/lib/supabase-smoke.mjs";

/**
 * 复测链路写库前的目标闸门（fail-closed）。
 *
 * 为什么重写
 * ----------
 * 原来的 assertSafeTarget 是 fail-open 的：
 *   if (env.PROD_SUPABASE_URL && url === env.PROD_SUPABASE_URL) throw
 * 两个洞叠在一起，等于没有守卫：
 *   1. PROD_SUPABASE_URL 是「一次性从生产只读拉数据」时才配的值（见 .env.example），
 *      平时根本不在 .env.local 里。没配 → 前半个条件为假 → 整条守卫静默失效。
 *      现状就是这样：复测一直在直写生产库，而终端上一句提示都没有。
 *   2. 就算配了，精确串比对也认不出同一个项目的不同写法（尾斜杠、大小写、
 *      带不带 /rest/v1），改一个字符就绕过去了。
 *
 * 现在的口径（照 scripts/ops/lib/supabase-smoke.mjs 的 assertTestTarget）
 * ------------------------------------------------------------------
 *   - 从 URL 里提 project ref 再比对，不比字符串，尾斜杠/大小写差异一律等价
 *   - 必须显式传 --expect-project=<ref>，点名这次要写哪个项目
 *   - 认不出 ref、没点名、点名和实际不一致 → 直接抛错，什么都不做
 *
 * 和 assertTestTarget 的唯一区别：**不禁止生产**。
 * 复测回写生产是既定的运营事实（站上的稳定分就是这么来的），把生产堵死等于
 * 让周一的复测流程跑不动。所以这里要的是「不许糊里糊涂地写」，不是「不许写」——
 * 想写生产就把生产的 ref 打在命令行上，写错项目那一刻就被挡住。
 *
 * 刻意不做 env 兜底
 * -----------------
 * supabase-smoke 允许 SUPABASE_TEST_PROJECT_REF 兜底，那是只读烟测。写库这条
 * 路上不给兜底：任何存在 .env.local 里的默认值都会被配一次然后忘掉，一年后
 * 又变回「守卫恒真」的老样子。每次写库都手打一次目标，是这次加固的全部意义。
 */

/** 本地 Supabase（supabase start）的 ref 占位。写本地也要显式点名，不给例外。 */
export const LOCAL_PROJECT_REF = "local";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "0.0.0.0"]);

/**
 * 把写入目标 URL 归一成一个可比对的 project ref。
 * 认不出来返回 null —— 调用方必须据此拒绝执行，不能当成「大概没事」。
 */
export function resolveWriteTargetRef(url) {
  const ref = projectRefFromUrl(url);
  if (ref) return ref.toLowerCase();
  try {
    const parsed = new URL(url);
    if (LOOPBACK_HOSTS.has(parsed.hostname)) return LOCAL_PROJECT_REF;
  } catch {
    return null;
  }
  return null;
}

/** --expect-project 允许直接贴一整个 Supabase URL，省得人肉截 ref。 */
export function normalizeExpectedRef(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return resolveWriteTargetRef(raw) ?? "";
  return raw.toLowerCase();
}

/**
 * @returns {{ projectRef: string, isKnownProduction: boolean }}
 * @throws 目标认不出、没点名、点名不一致时抛错；调用方不要 catch。
 */
export function assertWriteTarget({
  url,
  expectedProject,
  prodSupabaseUrl = "",
  command = "这个命令",
}) {
  if (!url) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL。");

  const actual = resolveWriteTargetRef(url);
  if (!actual) {
    throw new Error(
      `认不出写入目标是哪个 Supabase 项目（${url}）；${command} 拒绝在无法识别的目标上写库。`
    );
  }

  const expected = normalizeExpectedRef(expectedProject);
  if (!expected) {
    throw new Error(
      `${command} 会写库，必须显式点名目标：加 --expect-project=<project-ref>。\n` +
        `当前 .env.local 的 NEXT_PUBLIC_SUPABASE_URL 指向 ${actual}——确认无误就写 --expect-project=${actual}。`
    );
  }

  if (expected !== actual) {
    throw new Error(
      `拒绝执行：本次点名的是 ${expected}，但 .env.local 实际指向 ${actual}。两者一致才会写库。`
    );
  }

  const prodRef = prodSupabaseUrl ? resolveWriteTargetRef(prodSupabaseUrl) : null;
  return { projectRef: actual, isKnownProduction: Boolean(prodRef) && prodRef === actual };
}
