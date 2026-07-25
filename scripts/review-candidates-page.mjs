import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import {
  buildDailyReviewQueue,
  sourceInteractionCount,
} from "./review/lib/review-queue.mjs";

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

function metric(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("zh-CN").format(value) : "—";
}

function renderMedia(item) {
  const url = escapeHtml(item.media_url);
  if (!url) {
    return '<div class="media-empty">暂无媒体</div>';
  }
  if (item.media_kind === "video") {
    return `<video controls preload="none" poster="${escapeHtml(item.poster_url)}" src="${url}"></video>`;
  }
  return `<img loading="lazy" src="${url}" alt="${escapeHtml(item.title)}">`;
}

function renderCard(item, index) {
  const prompt = escapeHtml(item.prompt_full || item.prompt_preview);
  const code = `D${String(index + 1).padStart(2, "0")}`;
  const candidateId = escapeHtml(item.id);
  const shortId = escapeHtml(String(item.id).slice(0, 8));
  return `
    <article class="card" id="case-${code}" data-card data-candidate-id="${candidateId}" data-code="${code}">
      <div class="media">${renderMedia(item)}</div>
      <div class="content">
        <div class="eyebrow">
          <span class="number">${code}</span>
          <span>ID ${shortId}</span>
          <span class="status">${escapeHtml(item.status)}</span>
          <span>${escapeHtml(item.evidence_level)}</span>
          <span>${escapeHtml(item.source_platform)}</span>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="creator">作者：${escapeHtml(item.creator_name)}</p>
        <p class="summary">${escapeHtml(item.summary)}</p>
        <div class="metrics">
          <span>赞 ${metric(item.source_like_count)}</span>
          <span>评论 ${metric(item.source_comment_count)}</span>
          <span>转发 ${metric(item.source_share_count)}</span>
          <span>收藏 ${metric(item.source_save_count)}</span>
          <span>互动合计 ${metric(sourceInteractionCount(item))}</span>
        </div>
        <div class="actions">
          <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">查看 X 原帖 ↗</a>
          <button type="button" class="approve" data-decision="approve">通过</button>
          <button type="button" class="reject" data-decision="reject">拒绝</button>
          <button type="button" class="clear" data-decision="clear">清除</button>
          <strong class="decision" data-decision-label>未判断</strong>
        </div>
        <details>
          <summary>查看完整 Prompt</summary>
          <pre>${prompt}</pre>
        </details>
      </div>
    </article>`;
}

function renderPage(rows, batch, stats) {
  const cards = rows.map(renderCard).join("");
  const batchJson = JSON.stringify(batch);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GoodCase 候选审核 · ${escapeHtml(batch)}</title>
  <style>
    :root { color-scheme: light; --ink:#101010; --paper:#f4f1ea; --orange:#ff5a1f; --line:#cac6bd; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
    header { position:sticky; top:0; z-index:10; padding:18px 4vw; border-bottom:1px solid var(--ink); background:rgba(244,241,234,.96); backdrop-filter:blur(12px); }
    .brand { display:flex; align-items:baseline; justify-content:space-between; gap:20px; }
    h1 { margin:0; font-size:clamp(25px,4vw,48px); letter-spacing:-.04em; }
    .brand strong { color:var(--orange); }
    .notice { max-width:900px; margin:10px 0 0; font-size:14px; line-height:1.6; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:12px; }
    .toolbar button { padding:7px 11px; background:transparent; }
    .toolbar .copy-selection { border-color:var(--orange); color:var(--orange); }
    .progress { font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
    main { width:min(1280px,92vw); margin:30px auto 80px; display:grid; gap:24px; }
    .card { display:grid; grid-template-columns:minmax(300px,44%) 1fr; min-height:430px; background:#fff; border:1px solid var(--ink); box-shadow:8px 8px 0 var(--ink); overflow:hidden; }
    .card[data-state="approve"] { box-shadow:8px 8px 0 #16794b; }
    .card[data-state="reject"] { box-shadow:8px 8px 0 #b42318; opacity:.82; }
    .media { min-height:430px; background:#151515; display:grid; place-items:center; }
    .media img,.media video { width:100%; height:100%; max-height:680px; object-fit:contain; background:#151515; }
    .media-empty { color:#888; }
    .content { padding:28px; min-width:0; }
    .eyebrow,.metrics,.actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    .eyebrow span,.metrics span { border:1px solid var(--line); padding:5px 9px; font-size:12px; text-transform:uppercase; }
    .eyebrow .number { border-color:var(--ink); background:var(--ink); color:#fff; font-weight:800; }
    .eyebrow .status { border-color:var(--orange); color:var(--orange); font-weight:800; }
    h2 { margin:18px 0 8px; font-size:clamp(26px,3vw,44px); line-height:1.05; letter-spacing:-.04em; }
    .creator { font-weight:700; }
    .summary { color:#555; line-height:1.7; }
    .metrics { margin:18px 0; }
    .actions { margin:18px 0; }
    a,button { appearance:none; border:1px solid var(--ink); background:#fff; color:var(--ink); padding:10px 14px; font:inherit; font-weight:700; text-decoration:none; cursor:pointer; }
    a:hover,button:hover { background:var(--orange); color:#fff; border-color:var(--orange); }
    button.approve { border-color:#16794b; color:#16794b; }
    button.reject { border-color:#b42318; color:#b42318; }
    .decision { min-width:68px; font-size:13px; }
    details { margin-top:20px; border-top:1px solid var(--line); padding-top:16px; }
    summary { cursor:pointer; font-weight:800; }
    pre { margin:16px 0 0; padding:16px; max-height:420px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; background:#f5f5f5; border:1px solid var(--line); font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace; }
    footer { width:min(1280px,92vw); margin:0 auto 50px; color:#666; font-size:13px; }
    @media (max-width:760px) {
      .brand { display:block; }
      .card { grid-template-columns:1fr; }
      .media { min-height:280px; }
      .content { padding:22px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>GOODCASE <strong>每日快审</strong></h1>
      <span>${rows.length} / ${stats.totalPending} 条 · ${escapeHtml(batch)}</span>
    </div>
    <p class="notice">只读页面：本轮优先展示字段完整、原帖互动较高且作者不过度重复的候选。通过/拒绝只保存在当前浏览器，不会写数据库或自动上线。</p>
    <div class="toolbar">
      <button type="button" id="previous-page">← 上一页</button>
      <strong id="page-status"></strong>
      <button type="button" id="next-page">下一页 →</button>
      <button type="button" class="copy-selection" id="copy-selection">复制本轮审核结果</button>
      <span class="progress" id="decision-progress"></span>
    </div>
  </header>
  <main>${cards}</main>
  <footer>本页面仅监听 127.0.0.1，不属于线上 GoodCase 网站。</footer>
  <script>
    const cards = [...document.querySelectorAll(".card")];
    const pageSize = 12;
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
    let currentPage = 1;

    function renderPage() {
      const start = (currentPage - 1) * pageSize;
      cards.forEach((card, index) => {
        card.hidden = index < start || index >= start + pageSize;
      });
      document.querySelector("#page-status").textContent =
        "第 " + currentPage + " / " + totalPages + " 页";
      document.querySelector("#previous-page").disabled = currentPage === 1;
      document.querySelector("#next-page").disabled = currentPage === totalPages;
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    document.querySelector("#previous-page").addEventListener("click", () => {
      currentPage = Math.max(1, currentPage - 1);
      renderPage();
    });
    document.querySelector("#next-page").addEventListener("click", () => {
      currentPage = Math.min(totalPages, currentPage + 1);
      renderPage();
    });

    const storageKey = "goodcase-review:" + ${batchJson};
    let decisions = {};
    try {
      decisions = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      decisions = {};
    }

    function renderDecisions() {
      let approved = 0;
      let rejected = 0;
      for (const card of cards) {
        const state = decisions[card.dataset.candidateId] || "";
        card.dataset.state = state;
        const label = card.querySelector("[data-decision-label]");
        label.textContent =
          state === "approve" ? "已通过" : state === "reject" ? "已拒绝" : "未判断";
        approved += state === "approve" ? 1 : 0;
        rejected += state === "reject" ? 1 : 0;
      }
      document.querySelector("#decision-progress").textContent =
        "已判断 " + (approved + rejected) + " / ${rows.length} · 通过 " +
        approved + " · 拒绝 " + rejected;
      localStorage.setItem(storageKey, JSON.stringify(decisions));
    }

    for (const button of document.querySelectorAll("[data-decision]")) {
      button.addEventListener("click", () => {
        const card = button.closest("[data-card]");
        const decision = button.dataset.decision;
        if (decision === "clear") {
          delete decisions[card.dataset.candidateId];
        } else {
          decisions[card.dataset.candidateId] = decision;
        }
        renderDecisions();
      });
    }

    document.querySelector("#copy-selection").addEventListener("click", async (event) => {
      const approved = cards
        .filter((card) => decisions[card.dataset.candidateId] === "approve")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const rejected = cards
        .filter((card) => decisions[card.dataset.candidateId] === "reject")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const text =
        "批次 " + ${batchJson} +
        "\\n通过 " + (approved.join("、") || "无") +
        "\\n拒绝 " + (rejected.join("、") || "无");
      await navigator.clipboard.writeText(text);
      event.currentTarget.textContent = "审核结果已复制";
    });
    renderPage();
    renderDecisions();
  </script>
</body>
</html>`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const batch = getArg("--batch", "youmind-2026-07-25");
const port = Number(getArg("--port", "4318"));
const limit = Number(getArg("--limit", "20"));
const maxPerCreator = Number(getArg("--max-per-creator", "2"));

if (!url || !serviceRole) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`无效端口：${port}`);
}
if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
  throw new Error(`无效 limit：${limit}`);
}
if (!Number.isInteger(maxPerCreator) || maxPerCreator < 1 || maxPerCreator > 20) {
  throw new Error(`无效 max-per-creator：${maxPerCreator}`);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase
  .from("case_candidates")
  .select(
    "id,title,status,evidence_level,source_platform,source_url,source_metrics_captured_at,creator_name,summary,prompt_preview,prompt_full,media_kind,media_url,poster_url,source_like_count,source_comment_count,source_share_count,source_save_count,created_at"
  )
  .eq("import_batch_id", batch)
  .order("created_at", { ascending: true });

if (error) {
  throw new Error(`读取候选失败：${error.message}`);
}
if (!data?.length) {
  throw new Error(`批次没有候选：${batch}`);
}

const queue = buildDailyReviewQueue(data, { limit, maxPerCreator });
if (!queue.rows.length) {
  throw new Error(
    `批次没有可快审候选：pending=${queue.totalPending}, ready=${queue.totalReady}`
  );
}

const page = renderPage(queue.rows, batch, queue);
const server = http.createServer((request, response) => {
  if (request.url !== "/" && request.url !== "/favicon.ico") {
    response.writeHead(404).end("Not Found");
    return;
  }
  if (request.url === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(page);
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `GoodCase 每日快审页：http://127.0.0.1:${port}（${queue.rows.length}/${queue.totalPending}，排除 ${queue.totalExcluded}）`
  );
});
