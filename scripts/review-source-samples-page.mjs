#!/usr/bin/env node

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

function getArg(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(label, passed) {
  return `<span class="check ${passed ? "pass" : "miss"}">${passed ? "✓" : "·"} ${escapeHtml(label)}</span>`;
}

function renderMedia(item) {
  if (!item.mediaUrl) {
    return '<div class="media-empty">没有可展示媒体</div>';
  }
  if (item.mediaKind === "video") {
    const poster = item.posterUrl
      ? ` poster="${escapeHtml(item.posterUrl)}"`
      : "";
    return `<video controls preload="metadata"${poster} src="${escapeHtml(item.mediaUrl)}"></video>`;
  }
  return `<img loading="lazy" src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.title)}">`;
}

function renderCard(item, index) {
  const checks = item.checks || {};
  const details = [
    item.model ? `模型/工具：${item.model}` : "",
    item.license ? `许可：${item.license}` : "",
    item.notes || "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return `
    <article class="card"
      data-index="${index + 1}"
      data-source="${escapeHtml(item.sourceId)}"
      data-type="${escapeHtml(item.candidateType)}">
      <div class="media">${renderMedia(item)}</div>
      <div class="content">
        <div class="eyebrow">
          <span class="number">#${index + 1}</span>
          <span class="source">${escapeHtml(item.sourceLabel)}</span>
          <span class="kind ${item.candidateType === "case" ? "case" : "seed"}">${item.candidateType === "case" ? "CASE 候选" : "仅作线索"}</span>
          <span>${Math.round(Number(item.completeness || 0) * 100)}%</span>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="creator">作者：${escapeHtml(item.creator || "未知作者")}</p>
        <div class="checks">
          ${badge("原页", checks.source)}
          ${badge("作者", checks.author)}
          ${badge("结果", checks.result)}
          ${
            Object.hasOwn(checks, "prompt")
              ? badge("Prompt", checks.prompt)
              : ""
          }
          ${badge("方法", checks.method)}
          ${badge("许可", checks.license)}
        </div>
        <div class="actions">
          <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">查看原页 ↗</a>
          ${
            item.creatorUrl
              ? `<a href="${escapeHtml(item.creatorUrl)}" target="_blank" rel="noreferrer">作者页 ↗</a>`
              : ""
          }
        </div>
        ${
          item.promptText
            ? `<details class="prompt-details">
                <summary>完整 Prompt（站内展开）</summary>
                <button type="button" data-copy-prompt>复制 Prompt</button>
                <pre>${escapeHtml(item.promptText)}</pre>
              </details>`
            : `<p class="prompt-missing">⚠ 当前没有抓到可直接复制的完整 Prompt，按边界样本审核。</p>`
        }
        ${
          item.method
            ? `<details><summary>方法 / 工作流</summary><pre>${escapeHtml(item.method)}</pre></details>`
            : ""
        }
        <details>
          <summary>模型、许可与采集备注</summary>
          <pre>${escapeHtml(details)}</pre>
        </details>
        <div class="decision" role="group" aria-label="候选 #${index + 1} 审核决定">
          <button type="button" data-value="include">拟录入</button>
          <button type="button" data-value="seed">保留线索</button>
          <button type="button" data-value="reject">不收录</button>
          <button type="button" data-value="">清除</button>
        </div>
      </div>
    </article>`;
}

function renderSourceStatus(source) {
  return `
    <li class="${source.error ? "source-error" : ""}">
      <strong>${escapeHtml(source.label)}</strong>
      <span>${source.error ? `未抓到：${escapeHtml(source.error)}` : `${source.collected} 条 · ${source.cases} Case / ${source.topicSeeds} 线索`}</span>
    </li>`;
}

function renderPage(report, reportPath) {
  const pageTitle = report.title || "多来源影子审核";
  const cards = report.items.map(renderCard).join("");
  const sourceOptions = report.sources
    .filter((source) => source.collected > 0)
    .map(
      (source) =>
        `<option value="${escapeHtml(source.id)}">${escapeHtml(source.label)}（${source.collected}）</option>`
    )
    .join("");
  const status = report.sources.map(renderSourceStatus).join("");
  const storageKey = `goodcase-source-review:${report.runDate}:${report.generatedAt}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GoodCase ${escapeHtml(pageTitle)}</title>
  <style>
    :root { color-scheme:light; --ink:#101010; --paper:#f4f1ea; --orange:#ff5a1f; --green:#176b45; --red:#a83232; --line:#cac6bd; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
    header { position:sticky; top:0; z-index:20; padding:16px 4vw; border-bottom:1px solid var(--ink); background:rgba(244,241,234,.97); backdrop-filter:blur(12px); }
    .brand { display:flex; align-items:baseline; justify-content:space-between; gap:18px; }
    h1 { margin:0; font-size:clamp(24px,3.5vw,44px); letter-spacing:-.04em; }
    h1 strong { color:var(--orange); }
    .notice { margin:8px 0 0; max-width:980px; font-size:13px; line-height:1.6; }
    .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:12px; }
    select,button,a { appearance:none; border:1px solid var(--ink); background:#fff; color:var(--ink); padding:8px 11px; font:inherit; font-weight:700; text-decoration:none; cursor:pointer; }
    button:hover,a:hover { border-color:var(--orange); color:var(--orange); }
    .copy { border-color:var(--orange); color:var(--orange); }
    .overview { width:min(1360px,92vw); margin:24px auto 0; border:1px solid var(--ink); background:#fff; padding:18px; }
    .overview h2 { margin:0 0 12px; font-size:18px; }
    .overview ul { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; padding:0; margin:0; list-style:none; }
    .overview li { display:flex; flex-direction:column; gap:3px; border:1px solid var(--line); padding:9px; font-size:12px; }
    .overview .source-error { border-color:var(--red); color:var(--red); }
    main { width:min(1360px,92vw); margin:24px auto 80px; display:grid; gap:24px; }
    .card { display:grid; grid-template-columns:minmax(300px,43%) 1fr; min-height:440px; background:#fff; border:1px solid var(--ink); box-shadow:8px 8px 0 var(--ink); overflow:hidden; }
    .card[hidden] { display:none; }
    .media { min-height:440px; background:#151515; display:grid; place-items:center; }
    .media img,.media video { width:100%; height:100%; max-height:720px; object-fit:contain; background:#151515; }
    .media-empty { color:#888; }
    .content { padding:26px; min-width:0; }
    .eyebrow,.checks,.actions,.decision { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .eyebrow span,.check { border:1px solid var(--line); padding:5px 8px; font-size:11px; text-transform:uppercase; }
    .eyebrow .number { border-color:var(--ink); background:var(--ink); color:#fff; font-weight:800; }
    .eyebrow .source { border-color:var(--orange); color:var(--orange); font-weight:800; }
    .kind.case { border-color:var(--green); color:var(--green); }
    .kind.seed { border-color:#866600; color:#866600; }
    h2 { margin:17px 0 8px; font-size:clamp(24px,2.8vw,40px); line-height:1.05; letter-spacing:-.035em; overflow-wrap:anywhere; }
    .creator { font-weight:700; }
    .checks { margin:16px 0; }
    .check.pass { border-color:var(--green); color:var(--green); }
    .check.miss { border-color:var(--red); color:var(--red); }
    .actions { margin:16px 0; }
    details { margin-top:13px; border-top:1px solid var(--line); padding-top:12px; }
    summary { cursor:pointer; font-weight:800; }
    .prompt-details button { margin-top:12px; border-color:var(--orange); color:var(--orange); }
    .prompt-missing { margin:16px 0 0; padding:12px; border:1px solid var(--red); color:var(--red); font-weight:700; }
    pre { margin:12px 0 0; padding:14px; max-height:330px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; background:#f5f5f5; border:1px solid var(--line); font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .decision { margin-top:20px; padding-top:16px; border-top:1px solid var(--ink); }
    .decision button.active[data-value="include"] { background:var(--green); border-color:var(--green); color:#fff; }
    .decision button.active[data-value="seed"] { background:#866600; border-color:#866600; color:#fff; }
    .decision button.active[data-value="reject"] { background:var(--red); border-color:var(--red); color:#fff; }
    footer { width:min(1360px,92vw); margin:0 auto 48px; color:#666; font-size:12px; }
    @media (max-width:780px) {
      .brand { display:block; }
      .card { grid-template-columns:1fr; }
      .media { min-height:280px; }
      .content { padding:20px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>GOODCASE <strong>${escapeHtml(pageTitle)}</strong></h1>
      <span>${report.stats.total} 条 · ${escapeHtml(report.runDate)}</span>
    </div>
    <p class="notice">本页不连接 Supabase。决定只保存在当前浏览器，可随时清除；只有你明确把编号发给 Codex 后，才会考虑进入正式 pending。</p>
    <div class="toolbar">
      <select id="source-filter" aria-label="来源筛选"><option value="">全部来源</option>${sourceOptions}</select>
      <select id="type-filter" aria-label="类型筛选">
        <option value="">全部类型</option>
        <option value="case">Case 候选</option>
        <option value="topic_seed">仅作线索</option>
      </select>
      <select id="decision-filter" aria-label="决定筛选">
        <option value="">全部决定</option>
        <option value="include">拟录入</option>
        <option value="seed">保留线索</option>
        <option value="reject">不收录</option>
        <option value="undecided">未决定</option>
      </select>
      <button type="button" id="previous-page">← 上一页</button>
      <strong id="page-status"></strong>
      <button type="button" id="next-page">下一页 →</button>
      <button type="button" class="copy" id="copy-decisions">复制审核决定</button>
    </div>
  </header>
  <section class="overview">
    <h2>来源抓取状态</h2>
    <ul>${status}</ul>
  </section>
  <main>${cards}</main>
  <footer>报告：${escapeHtml(reportPath)} · 仅监听 127.0.0.1。</footer>
  <script>
    const storageKey = ${JSON.stringify(storageKey)};
    const allCards = [...document.querySelectorAll(".card")];
    const decisions = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const pageSize = 12;
    let currentPage = 1;

    async function copyText(text) {
      try {
        if (!navigator.clipboard?.writeText) return false;
        return await Promise.race([
          navigator.clipboard
            .writeText(text)
            .then(() => true)
            .catch(() => false),
          new Promise((resolve) => setTimeout(() => resolve(false), 800)),
        ]);
      } catch {
        return false;
      }
    }

    function decisionFor(card) {
      return decisions[card.dataset.index] || "";
    }
    function paintDecision(card) {
      const value = decisionFor(card);
      card.querySelectorAll(".decision button").forEach((button) => {
        button.classList.toggle("active", button.dataset.value && button.dataset.value === value);
      });
    }
    function filteredCards() {
      const source = document.querySelector("#source-filter").value;
      const type = document.querySelector("#type-filter").value;
      const decision = document.querySelector("#decision-filter").value;
      return allCards.filter((card) => {
        const cardDecision = decisionFor(card);
        return (!source || card.dataset.source === source) &&
          (!type || card.dataset.type === type) &&
          (!decision || (decision === "undecided" ? !cardDecision : cardDecision === decision));
      });
    }
    function render({ scrollToTop = false } = {}) {
      const filtered = filteredCards();
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(currentPage, totalPages);
      const visible = new Set(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));
      const decidedCount = Object.keys(decisions).length;
      allCards.forEach((card) => {
        card.hidden = !visible.has(card);
        paintDecision(card);
      });
      document.querySelector("#page-status").textContent =
        "第 " + currentPage + " / " + totalPages + " 页 · " + filtered.length +
        " 条 · 已审 " + decidedCount + " / " + allCards.length;
      document.querySelector("#previous-page").disabled = currentPage === 1;
      document.querySelector("#next-page").disabled = currentPage === totalPages;
      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    }
    function resetAndRender() {
      currentPage = 1;
      render({ scrollToTop: true });
    }
    document.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", resetAndRender);
    });
    document.querySelector("#previous-page").addEventListener("click", () => {
      currentPage = Math.max(1, currentPage - 1);
      render({ scrollToTop: true });
    });
    document.querySelector("#next-page").addEventListener("click", () => {
      currentPage += 1;
      render({ scrollToTop: true });
    });
    allCards.forEach((card) => {
      card.querySelector("[data-copy-prompt]")?.addEventListener("click", (event) => {
        const promptNode = card.querySelector(".prompt-details pre");
        if (!promptNode) return;
        const range = document.createRange();
        range.selectNodeContents(promptNode);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        event.currentTarget.textContent = "已选中，请 ⌘C";
        setTimeout(() => { event.currentTarget.textContent = "复制 Prompt"; }, 2400);
      });
      card.querySelector(".decision").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        if (button.dataset.value) decisions[card.dataset.index] = button.dataset.value;
        else delete decisions[card.dataset.index];
        localStorage.setItem(storageKey, JSON.stringify(decisions));
        render();
      });
    });
    document.querySelector("#copy-decisions").addEventListener("click", async (event) => {
      const grouped = { include: [], seed: [], reject: [] };
      Object.entries(decisions).forEach(([index, value]) => grouped[value]?.push("#" + index));
      const parts = [
        grouped.include.length ? "拟录入 " + grouped.include.join("、") : "",
        grouped.seed.length ? "保留线索 " + grouped.seed.join("、") : "",
        grouped.reject.length ? "不收录 " + grouped.reject.join("、") : "",
      ].filter(Boolean);
      const text = parts.length ? parts.join("\\n") : "尚未做审核决定";
      event.currentTarget.textContent = "复制中…";
      const copied = await copyText(text);
      event.currentTarget.textContent = copied ? "已复制" : "复制失败";
      setTimeout(() => { event.currentTarget.textContent = "复制审核决定"; }, 1200);
    });
    render();
  </script>
</body>
</html>`;
}

const reportPath = path.resolve(
  getArg(
    "--file",
    "tmp/supply-reports/2026-07-25-alternative-source-samples.json"
  )
);
const port = Number(getArg("--port", "4319"));
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`无效端口：${port}`);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
if (!Array.isArray(report.items) || !Array.isArray(report.sources)) {
  throw new Error(`报告格式无效：${reportPath}`);
}
const page = renderPage(report, reportPath);
const server = http.createServer((request, response) => {
  if (request.url === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  if (request.url !== "/") {
    response.writeHead(404).end("Not Found");
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
  console.log(`GoodCase 多来源影子审核页：http://127.0.0.1:${port}`);
});
