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
  return `
    <article class="card" id="case-${index + 1}">
      <div class="media">${renderMedia(item)}</div>
      <div class="content">
        <div class="eyebrow">
          <label class="select"><input type="checkbox" data-select="${index + 1}"> 选择</label>
          <span class="number">#${index + 1}</span>
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
        </div>
        <div class="actions">
          <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">查看 X 原帖 ↗</a>
          <button type="button" data-copy="通过 #${index + 1}">复制“通过 #${index + 1}”</button>
        </div>
        <details>
          <summary>查看完整 Prompt</summary>
          <pre>${prompt}</pre>
        </details>
      </div>
    </article>`;
}

function renderPage(rows, batch) {
  const cards = rows.map(renderCard).join("");
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
    main { width:min(1280px,92vw); margin:30px auto 80px; display:grid; gap:24px; }
    .card { display:grid; grid-template-columns:minmax(300px,44%) 1fr; min-height:430px; background:#fff; border:1px solid var(--ink); box-shadow:8px 8px 0 var(--ink); overflow:hidden; }
    .media { min-height:430px; background:#151515; display:grid; place-items:center; }
    .media img,.media video { width:100%; height:100%; max-height:680px; object-fit:contain; background:#151515; }
    .media-empty { color:#888; }
    .content { padding:28px; min-width:0; }
    .eyebrow,.metrics,.actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    .eyebrow span,.metrics span { border:1px solid var(--line); padding:5px 9px; font-size:12px; text-transform:uppercase; }
    .select { display:flex; gap:6px; align-items:center; padding:4px 8px; border:1px solid var(--line); font-size:12px; font-weight:700; }
    .eyebrow .number { border-color:var(--ink); background:var(--ink); color:#fff; font-weight:800; }
    .eyebrow .status { border-color:var(--orange); color:var(--orange); font-weight:800; }
    h2 { margin:18px 0 8px; font-size:clamp(26px,3vw,44px); line-height:1.05; letter-spacing:-.04em; }
    .creator { font-weight:700; }
    .summary { color:#555; line-height:1.7; }
    .metrics { margin:18px 0; }
    .actions { margin:18px 0; }
    a,button { appearance:none; border:1px solid var(--ink); background:#fff; color:var(--ink); padding:10px 14px; font:inherit; font-weight:700; text-decoration:none; cursor:pointer; }
    a:hover,button:hover { background:var(--orange); color:#fff; border-color:var(--orange); }
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
      <h1>GOODCASE <strong>候选审核</strong></h1>
      <span>${rows.length} 条 · ${escapeHtml(batch)}</span>
    </div>
    <p class="notice">只读页面：状态以卡片为准，浏览和勾选都不会自动上线。请检查作品、原帖与 Prompt，再复制已选编号交给 Codex 审核。</p>
    <div class="toolbar">
      <button type="button" id="previous-page">← 上一页</button>
      <strong id="page-status"></strong>
      <button type="button" id="next-page">下一页 →</button>
      <button type="button" class="copy-selection" id="copy-selection">复制已选通过编号</button>
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
    document.querySelector("#copy-selection").addEventListener("click", async (event) => {
      const selected = [...document.querySelectorAll("[data-select]:checked")]
        .map((input) => "#" + input.dataset.select);
      const text = selected.length ? "通过 " + selected.join("、") : "尚未选择候选";
      await navigator.clipboard.writeText(text);
      event.currentTarget.textContent = "已复制：" + text;
    });
    for (const button of document.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", async () => {
        const text = button.dataset.copy;
        await navigator.clipboard.writeText(text);
        button.textContent = "已复制：" + text;
      });
    }
    renderPage();
  </script>
</body>
</html>`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const batch = getArg("--batch", "youmind-2026-07-25");
const port = Number(getArg("--port", "4318"));

if (!url || !serviceRole) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`无效端口：${port}`);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase
  .from("case_candidates")
  .select(
    "id,title,status,evidence_level,source_platform,source_url,creator_name,summary,prompt_preview,prompt_full,media_kind,media_url,poster_url,source_like_count,source_comment_count,source_share_count,source_save_count,created_at"
  )
  .eq("import_batch_id", batch)
  .order("created_at", { ascending: true });

if (error) {
  throw new Error(`读取候选失败：${error.message}`);
}
if (!data?.length) {
  throw new Error(`批次没有候选：${batch}`);
}

const page = renderPage(data, batch);
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
  console.log(`GoodCase 候选审核页：http://127.0.0.1:${port}`);
});
