import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import { buildDedupeKey, normalizeCategory, slugify } from "@/lib/candidate-dedupe";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const JSON_HEADERS = { "Content-Type": "application/json" };

function methodNotAllowed() {
  return Response.json(
    { error: "method not allowed" },
    { status: 405, headers: { ...JSON_HEADERS, Allow: "POST" } }
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid json body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return Response.json({ error: "invalid json body" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;

    // honeypot：机器人填了隐藏字段，假装成功但不写库。
    if (asTrimmedString(raw.website)) {
      return Response.json({ ok: true }, { status: 200 });
    }

    const url = asTrimmedString(raw.url);
    const parsedUrl = parseHttpUrl(url);
    if (!parsedUrl) {
      return Response.json({ error: "url is required and must be a valid http(s) url" }, { status: 400 });
    }

    const title = asTrimmedString(raw.title);
    if (!title || title.length > 120) {
      return Response.json({ error: "title is required (max 120 chars)" }, { status: 400 });
    }

    const category = normalizeCategory(raw.category ?? "web");

    const summary = asTrimmedString(raw.summary);
    const prompt = asTrimmedString(raw.prompt);
    if (summary.length > 2000 || prompt.length > 2000) {
      return Response.json({ error: "summary/prompt too long (max 2000 chars)" }, { status: 400 });
    }

    const creatorName = asTrimmedString(raw.creatorName);
    const contact = asTrimmedString(raw.contact);
    if (creatorName.length > 120 || contact.length > 120) {
      return Response.json({ error: "creatorName/contact too long (max 120 chars)" }, { status: 400 });
    }

    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      return Response.json({ error: "submissions temporarily unavailable" }, { status: 503 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from("case_candidates")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gt("created_at", windowStart);

    if (countError) {
      return Response.json({ error: "internal error" }, { status: 500 });
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return Response.json({ error: "too many submissions, try again later" }, { status: 429 });
    }

    // case_candidates 没有 source_url 列，url 落到 media_url（同时参与 dedupe_key）；
    // source_platform 记来源域名，summary/media_kind 为 not null 列需兜底。
    const candidate = {
      slug: slugify(title),
      title,
      category,
      source_platform: parsedUrl.hostname || null,
      creator_name: creatorName || null,
      summary: summary || "暂无摘要",
      prompt_full: prompt || null,
      media_kind: category === "video" ? "video" : "image",
      media_url: url,
      status: "pending",
      import_batch_id: "web-submit",
      submitted_via: "web",
      contact: contact || null,
      ip_hash: ipHash,
    };

    const dedupeKey = buildDedupeKey({
      title: candidate.title,
      creator_name: candidate.creator_name,
      source_platform: candidate.source_platform,
      media_url: candidate.media_url,
    });

    const { error: upsertError } = await supabase
      .from("case_candidates")
      .upsert({ ...candidate, dedupe_key: dedupeKey }, { onConflict: "dedupe_key" });

    if (upsertError) {
      return Response.json({ error: "internal error" }, { status: 500 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
