#!/usr/bin/env node

import http from "node:http";
import { createClient } from "@supabase/supabase-js";

function getArg(name, fallback) {
  const prefix = `${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function renderFeedback(item) {
  return `
    <article class="item">
      <div class="meta">
        <span class="kind">反馈</span>
        <span>${escapeHtml(item.kind)}</span>
        <span>${escapeHtml(item.status)}</span>
        <time>${escapeHtml(formatTime(item.created_at))}</time>
      </div>
      <p class="body">${escapeHtml(item.message)}</p>
      <dl>
        <dt>联系方式</dt><dd>${escapeHtml(item.contact || "未填写")}</dd>
        <dt>来源页面</dt><dd>${escapeHtml(item.page || "未记录")}</dd>
        <dt>收件编号</dt><dd class="mono">${escapeHtml(item.id)}</dd>
      </dl>
    </article>`;
}

function renderCandidate(item) {
  return `
    <article class="item">
      <div class="meta">
        <span class="kind case">Case</span>
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.status)}</span>
        <time>${escapeHtml(formatTime(item.created_at))}</time>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="body">${escapeHtml(item.summary)}</p>
      <dl>
        <dt>作者</dt><dd>${escapeHtml(item.creator_name || "未填写")}</dd>
        <dt>联系方式</dt><dd>${escapeHtml(item.contact || "未填写")}</dd>
        <dt>Prompt</dt><dd>${item.prompt_full ? "已提供" : "未提供"}</dd>
        <dt>收件编号</dt><dd class="mono">${escapeHtml(item.id)}</dd>
      </dl>
      <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">查看原始来源 ↗</a>
    </article>`;
}

function renderPage(feedback, candidates) {
  const feedbackCards = feedback.length
    ? feedback.map(renderFeedback).join("")
    : '<p class="empty">暂无反馈</p>';
  const candidateCards = candidates.length
    ? candidates.map(renderCandidate).join("")
    : '<p class="empty">暂无网页投稿</p>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="15">
  <title>GoodCase 运营收件箱</title>
  <style>
    :root { --ink:#111; --paper:#f5f2eb; --white:#fff; --orange:#cc3d08; --line:#aaa69d; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:Inter,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
    header { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; gap:20px; padding:22px 4vw; border-bottom:1px solid var(--ink); background:rgba(245,242,235,.96); }
    h1 { margin:0; font-size:clamp(28px,5vw,56px); letter-spacing:-.05em; }
    header p { margin:8px 0 0; color:#666; }
    .totals { display:flex; gap:10px; align-items:center; }
    .totals span,.meta span,.meta time { border:1px solid var(--line); background:var(--white); padding:7px 10px; font:12px ui-monospace,SFMono-Regular,Menlo,monospace; }
    main { width:min(1500px,94vw); margin:28px auto 70px; display:grid; gap:24px; grid-template-columns:1fr 1fr; }
    section { min-width:0; border:1px solid var(--ink); background:var(--white); }
    h2 { margin:0; padding:18px 20px; border-bottom:1px solid var(--ink); font-size:22px; }
    .list { display:grid; }
    .item { padding:20px; border-bottom:1px solid var(--line); }
    .item:last-child { border-bottom:0; }
    .meta { display:flex; flex-wrap:wrap; gap:7px; }
    .meta .kind { border-color:var(--orange); background:var(--orange); color:#fff; }
    .meta .case { background:var(--ink); border-color:var(--ink); }
    h3 { margin:18px 0 8px; font-size:24px; }
    .body { margin:18px 0; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.7; }
    dl { display:grid; grid-template-columns:90px minmax(0,1fr); margin:18px 0; border-top:1px solid var(--line); }
    dt,dd { margin:0; padding:9px 0; border-bottom:1px solid var(--line); overflow-wrap:anywhere; }
    dt { color:#777; }
    .mono { font:12px ui-monospace,SFMono-Regular,Menlo,monospace; }
    a { display:inline-flex; border:1px solid var(--ink); padding:10px 13px; color:var(--ink); text-decoration:none; font-weight:700; }
    a:hover { background:var(--orange); border-color:var(--orange); color:#fff; }
    .empty { padding:24px; color:#777; }
    footer { width:min(1500px,94vw); margin:0 auto 40px; color:#777; font-size:13px; }
    @media (max-width:850px) {
      header { display:block; }
      .totals { margin-top:16px; }
      main { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>GoodCase 运营收件箱</h1>
      <p>生产数据库只读视图 · 每 15 秒刷新</p>
    </div>
    <div class="totals">
      <span>待处理反馈 ${feedback.length}</span>
      <span>待审核投稿 ${candidates.length}</span>
    </div>
  </header>
  <main>
    <section>
      <h2>反馈</h2>
      <div class="list">${feedbackCards}</div>
    </section>
    <section>
      <h2>网页投稿 Case</h2>
      <div class="list">${candidateCards}</div>
    </section>
  </main>
  <footer>仅监听 127.0.0.1，不属于公开 GoodCase 网站；联系方式和反馈正文不会发送给浏览器之外的第三方。</footer>
</body>
</html>`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const port = Number(getArg("--port", "4320"));

if (!url || !serviceRole) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`无效端口：${port}`);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readInbox() {
  const [feedbackResult, candidateResult] = await Promise.all([
    supabase
      .from("feedback_messages")
      .select("id,kind,message,contact,page,status,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("case_candidates")
      .select(
        "id,title,category,source_url,creator_name,summary,prompt_full,contact,status,created_at"
      )
      .eq("submitted_via", "web")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (feedbackResult.error) {
    throw new Error(`读取反馈失败：${feedbackResult.error.message}`);
  }
  if (candidateResult.error) {
    throw new Error(`读取网页投稿失败：${candidateResult.error.message}`);
  }

  return {
    feedback: feedbackResult.data || [],
    candidates: candidateResult.data || [],
  };
}

const server = http.createServer(async (request, response) => {
  if (request.url === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  if (request.url !== "/") {
    response.writeHead(404).end("Not Found");
    return;
  }

  try {
    const inbox = await readInbox();
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(renderPage(inbox.feedback, inbox.candidates));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "读取失败");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GoodCase 运营收件箱：http://127.0.0.1:${port}`);
});
