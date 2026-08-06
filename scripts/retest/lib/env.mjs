import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 读 .env.local。
 *
 * 沿用 scripts/review/unpublish-cases.mjs 里那份解析：值两端的成对引号要剥掉，
 * 因为 vercel env pull 写出来的行是带引号的，直接当值用会把引号也发给 Blob。
 */
export async function readEnvLocal(cwd = process.cwd()) {
  const text = await readFile(path.join(cwd, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === '"' || value[0] === "'")
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

/** 只读的 PostgREST 查询。写库单独走 postJson，方便在调用点看清哪些是写。 */
export function createSupabaseReader(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    async select(pathAndQuery) {
      const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        throw new Error(`GET ${pathAndQuery} → ${response.status} ${await response.text()}`);
      }
      return response.json();
    },

    async insert(table, rows) {
      const response = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(rows),
      });
      const body = await response.text();
      return { ok: response.ok, status: response.status, body };
    },
  };
}
