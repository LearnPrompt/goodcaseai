import http from "node:http";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  buildRecommendationReviewPlan,
  buildDailyReviewQueue,
  filterCandidatesByIds,
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

function renderReviewFlags(item) {
  const labels = {
    "license-review": "许可待核",
    "not-rerun": "GoodCase 未复跑",
    "workflow-method": "工作流方法",
    "prompt-public": "公开 Prompt",
  };
  return (item.tags || [])
    .filter((tag) => labels[tag])
    .map((tag) => `<span class="flag">${labels[tag]}</span>`)
    .join("");
}

const recommendationLabels = {
  approve: "机器建议：通过",
  reject: "机器建议：拒绝",
  borderline: "机器建议：拿不准",
};

function renderCard(item, index, recommendation) {
  const prompt = escapeHtml(item.prompt_full || item.prompt_preview);
  const code = `D${String(index + 1).padStart(2, "0")}`;
  const candidateId = escapeHtml(item.id);
  const shortId = escapeHtml(String(item.id).slice(0, 8));
  const recommendedDecision = escapeHtml(
    recommendation?.recommended_decision || ""
  );
  const recommendationMarkup = recommendation
    ? `<div class="recommendation">
        <strong>${escapeHtml(recommendationLabels[recommendation.recommended_decision])}</strong>
        <span>${escapeHtml(recommendation.rule)}</span>
      </div>`
    : "";
  const acceptRecommendationButton = recommendation
    ? '<button type="button" class="accept-recommendation" data-accept-recommendation>采用机器建议 ↵</button>'
    : "";
  return `
    <article class="card" id="case-${code}" data-card data-candidate-id="${candidateId}" data-code="${code}" data-recommended-decision="${recommendedDecision}">
      <div class="media">${renderMedia(item)}</div>
      <div class="content">
        <div class="eyebrow">
          <span class="number">${code}</span>
          <span>ID ${shortId}</span>
          <span class="status">${escapeHtml(item.status)}</span>
          <span>${escapeHtml(item.evidence_level)}</span>
          <span>${escapeHtml(item.source_platform)}</span>
        </div>
        <div class="flags">${renderReviewFlags(item)}</div>
        ${recommendationMarkup}
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
          <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">查看原始来源 ↗</a>
          <button type="button" class="approve" data-decision="approve">通过</button>
          <button type="button" class="reject" data-decision="reject">拒绝</button>
          <button type="button" class="borderline" data-decision="borderline">拿不准</button>
          <button type="button" class="skip" data-decision="skip">跳过</button>
          <button type="button" class="clear" data-decision="clear">清除</button>
          ${acceptRecommendationButton}
          <strong class="decision" data-decision-label>未判断</strong>
        </div>
        <details>
          <summary>查看完整 Prompt</summary>
          <pre>${prompt}</pre>
        </details>
      </div>
    </article>`;
}

function renderPage(rows, batch, stats, recommendations = new Map()) {
  const cards = rows
    .map((item, index) => renderCard(item, index, recommendations.get(item.id)))
    .join("");
  const batchJson = JSON.stringify(batch);
  const hasRecommendations = recommendations.size > 0;
  const sourceCounts = Object.entries(
    Object.groupBy(rows, (item) => item.source_platform || "未知来源")
  )
    .map(([source, items]) => `${escapeHtml(source)} ${items.length}`)
    .join(" · ");
  const reviewNotice = hasRecommendations
    ? "页面显示机器预判，但不会自动采纳。按 Enter 或点击“采用机器建议”确认，也可以用 A / R / B 覆盖；决定只保存在当前浏览器，不会写数据库或自动上线。"
    : "只读页面：本轮优先展示字段完整、作者不过度重复的候选。请为每条选择通过、拒绝、拿不准或跳过；决定只保存在当前浏览器，不会写数据库或自动上线。";
  const shortcutHelp = hasRecommendations
    ? "快捷键：Enter 采用建议 · A 通过 · R 拒绝 · B 拿不准 · S 跳过 · C 清除 · ←/→ 切换"
    : "快捷键：A 通过 · R 拒绝 · B 拿不准 · S 跳过 · C 清除 · ←/→ 切换";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GoodCase 候选审核 · ${escapeHtml(batch)}</title>
  <style>
    :root { color-scheme: light; --ink:#101010; --paper:#f4f1ea; --orange:#ff5a1f; --line:#cac6bd; }
    * { box-sizing:border-box; }
    html,body { min-height:100%; overflow-y:auto; overscroll-behavior-y:auto; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
    header { position:sticky; top:0; z-index:10; padding:18px 4vw; border-bottom:1px solid var(--ink); background:rgba(244,241,234,.96); backdrop-filter:blur(12px); }
    .brand { display:flex; align-items:baseline; justify-content:space-between; gap:20px; }
    h1 { margin:0; font-size:clamp(25px,4vw,48px); letter-spacing:-.04em; }
    .brand strong { color:var(--orange); }
    .notice { max-width:900px; margin:10px 0 0; font-size:14px; line-height:1.6; }
    .source-summary { margin:8px 0 0; font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#555; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:12px; }
    .toolbar button { padding:7px 11px; background:transparent; }
    .toolbar .copy-selection { border-color:var(--orange); color:var(--orange); }
    .shortcut-help { color:#666; font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .review-hint { min-height:22px; margin:8px 0 0; color:#b42318; font-size:13px; font-weight:800; }
    .progress { font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
    main { width:min(1280px,92vw); margin:30px auto 80px; display:grid; gap:24px; }
    .card { display:grid; grid-template-columns:minmax(300px,44%) 1fr; min-height:430px; background:#fff; border:1px solid var(--ink); box-shadow:8px 8px 0 var(--ink); overflow:hidden; }
    .card[hidden] { display:none; }
    .card[data-state="approve"] { box-shadow:8px 8px 0 #16794b; }
    .card[data-state="reject"] { box-shadow:8px 8px 0 #b42318; opacity:.82; }
    .card[data-state="borderline"] { box-shadow:8px 8px 0 #b7791f; }
    .media { min-height:430px; background:#151515; display:grid; place-items:center; }
    .media img,.media video { width:100%; height:100%; max-height:680px; object-fit:contain; background:#151515; }
    .media-empty { color:#888; }
    .content { padding:28px; min-width:0; }
    .eyebrow,.flags,.metrics,.actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    .eyebrow span,.metrics span { border:1px solid var(--line); padding:5px 9px; font-size:12px; text-transform:uppercase; }
    .eyebrow .number { border-color:var(--ink); background:var(--ink); color:#fff; font-weight:800; }
    .eyebrow .status { border-color:var(--orange); color:var(--orange); font-weight:800; }
    .flags { margin-top:12px; }
    .flag { border:1px solid #b7791f; background:#fff7df; color:#8a5a00; padding:5px 9px; font-size:12px; font-weight:800; }
    .recommendation { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:12px; padding:10px 12px; border:1px dashed #7c3aed; background:#f5f0ff; color:#5b21b6; font-size:12px; }
    .recommendation span { color:#6b5a86; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    h2 { margin:18px 0 8px; font-size:clamp(26px,3vw,44px); line-height:1.05; letter-spacing:-.04em; }
    .creator { font-weight:700; }
    .summary { color:#555; line-height:1.7; }
    .metrics { margin:18px 0; }
    .actions { margin:18px 0; }
    a,button { appearance:none; border:1px solid var(--ink); background:#fff; color:var(--ink); padding:10px 14px; font:inherit; font-weight:700; text-decoration:none; cursor:pointer; }
    a:hover,button:hover { background:var(--orange); color:#fff; border-color:var(--orange); }
    button.approve { border-color:#16794b; color:#16794b; }
    button.reject { border-color:#b42318; color:#b42318; }
    button.borderline { border-color:#b7791f; color:#8a5a00; }
    button.skip { border-color:#666; color:#555; }
    button.accept-recommendation { border-color:#7c3aed; color:#6d28d9; }
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
    <p class="notice">${reviewNotice}</p>
    <p class="source-summary">${sourceCounts}</p>
    <div class="toolbar">
      <button type="button" id="previous-page">← 上一条</button>
      <strong id="page-status"></strong>
      <button type="button" id="next-page">下一条 →</button>
      <button type="button" class="copy-selection" id="copy-selection">复制本轮审核结果</button>
      <span class="progress" id="decision-progress"></span>
      <span class="shortcut-help">${shortcutHelp}</span>
    </div>
    <p class="review-hint" id="review-hint" aria-live="polite"></p>
  </header>
  <main>${cards}</main>
  <footer>本页面仅监听 127.0.0.1，不属于线上 GoodCase 网站。</footer>
  <script>
    const cards = [...document.querySelectorAll(".card")];
    const pageSize = 1;
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
    let currentPage = 1;

    function renderPage() {
      const start = (currentPage - 1) * pageSize;
      cards.forEach((card, index) => {
        card.hidden = index < start || index >= start + pageSize;
      });
      document.querySelector("#page-status").textContent =
        "第 " + currentPage + " / " + totalPages + " 条";
      document.querySelector("#previous-page").disabled = currentPage === 1;
      document.querySelector("#next-page").disabled = currentPage === totalPages;
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    function move(delta) {
      currentPage = Math.min(totalPages, Math.max(1, currentPage + delta));
      document.querySelector("#review-hint").textContent = "";
      renderPage();
    }

    function goNext() {
      const activeCard = cards[currentPage - 1];
      if (!decisions[activeCard.dataset.candidateId]) {
        document.querySelector("#review-hint").textContent =
          "请先选择通过、拒绝、拿不准，或按 S 明确跳过。";
        return;
      }
      move(1);
    }

    document.querySelector("#previous-page").addEventListener("click", () => move(-1));
    document.querySelector("#next-page").addEventListener("click", goNext);

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
      let borderline = 0;
      let skipped = 0;
      for (const card of cards) {
        const state = decisions[card.dataset.candidateId] || "";
        card.dataset.state = state;
        const label = card.querySelector("[data-decision-label]");
        label.textContent =
          state === "approve"
            ? "已通过"
            : state === "reject"
              ? "已拒绝"
              : state === "borderline"
                ? "拿不准"
                : state === "skip"
                  ? "已跳过"
                : "未判断";
        approved += state === "approve" ? 1 : 0;
        rejected += state === "reject" ? 1 : 0;
        borderline += state === "borderline" ? 1 : 0;
        skipped += state === "skip" ? 1 : 0;
      }
      document.querySelector("#decision-progress").textContent =
        "已处理 " + (approved + rejected + borderline + skipped) + " / ${rows.length} · 通过 " +
        approved + " · 拒绝 " + rejected + " · 拿不准 " + borderline +
        " · 跳过 " + skipped;
      localStorage.setItem(storageKey, JSON.stringify(decisions));
    }

    function setDecision(card, decision, advance = true) {
      if (decision === "clear") {
        delete decisions[card.dataset.candidateId];
      } else {
        decisions[card.dataset.candidateId] = decision;
      }
      renderDecisions();
      document.querySelector("#review-hint").textContent = "";
      if (advance && decision !== "clear" && currentPage < totalPages) {
        move(1);
      } else if (advance && decision !== "clear" && currentPage === totalPages) {
        document.querySelector("#review-hint").textContent =
          "本轮已处理到最后一条，可以告诉 Codex 继续生成偏好规则。";
      }
    }

    for (const button of document.querySelectorAll("[data-decision]")) {
      button.addEventListener("click", () => {
        setDecision(button.closest("[data-card]"), button.dataset.decision);
      });
    }

    for (const button of document.querySelectorAll("[data-accept-recommendation]")) {
      button.addEventListener("click", () => {
        const card = button.closest("[data-card]");
        if (card.dataset.recommendedDecision) {
          setDecision(card, card.dataset.recommendedDecision);
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(
          event.target.tagName
        )
      ) {
        return;
      }
      const activeCard = cards[currentPage - 1];
      const key = event.key.toLowerCase();
      if (key === "a") {
        setDecision(activeCard, "approve");
      } else if (key === "r") {
        setDecision(activeCard, "reject");
      } else if (key === "b") {
        setDecision(activeCard, "borderline");
      } else if (key === "c") {
        setDecision(activeCard, "clear", false);
      } else if (key === "s") {
        setDecision(activeCard, "skip");
      } else if (event.key === "Enter" && activeCard.dataset.recommendedDecision) {
        setDecision(activeCard, activeCard.dataset.recommendedDecision);
      } else if (event.key === "ArrowRight") {
        goNext();
      } else if (event.key === "ArrowLeft") {
        move(-1);
      } else {
        return;
      }
      event.preventDefault();
    });

    document.querySelector("#copy-selection").addEventListener("click", async (event) => {
      const approved = cards
        .filter((card) => decisions[card.dataset.candidateId] === "approve")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const rejected = cards
        .filter((card) => decisions[card.dataset.candidateId] === "reject")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const borderline = cards
        .filter((card) => decisions[card.dataset.candidateId] === "borderline")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const skipped = cards
        .filter((card) => decisions[card.dataset.candidateId] === "skip")
        .map((card) => card.dataset.code + ":" + card.dataset.candidateId.slice(0, 8));
      const text =
        "批次 " + ${batchJson} +
        "\\n通过 " + (approved.join("、") || "无") +
        "\\n拒绝 " + (rejected.join("、") || "无") +
        "\\n拿不准 " + (borderline.join("、") || "无") +
        "\\n跳过 " + (skipped.join("、") || "无");
      await navigator.clipboard.writeText(text);
      event.currentTarget.textContent = "审核结果已复制";
    });
    renderDecisions();
    const firstUndecided = cards.findIndex(
      (card) => !decisions[card.dataset.candidateId]
    );
    currentPage = firstUndecided === -1 ? 1 : firstUndecided + 1;
    renderPage();
  </script>
</body>
</html>`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const batch = getArg("--batch", "youmind-2026-07-25");
const reviewKey = getArg("--review-key", batch);
const port = Number(getArg("--port", "4318"));
const limit = Number(getArg("--limit", "20"));
const maxPerCreator = Number(getArg("--max-per-creator", "2"));
const recommendationsFile = getArg("--recommendations-file", "");
const recommendationGroups = [
  ...new Set(
    getArg("--recommendation-groups", "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];
const includeIds = [
  ...new Set(
    getArg("--include-ids", "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

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
if (includeIds.length > 200) {
  throw new Error(`include-ids 不能超过 200 条：${includeIds.length}`);
}
if (recommendationGroups.length > 0 && !recommendationsFile) {
  throw new Error("--recommendation-groups 需要 --recommendations-file。");
}

let recommendationPlan = [];
if (recommendationsFile) {
  const recommendationPayload = JSON.parse(
    await readFile(recommendationsFile, "utf8")
  );
  recommendationPlan = buildRecommendationReviewPlan(
    recommendationPayload.items,
    recommendationGroups
  );
  if (!recommendationPlan.length) {
    throw new Error("推荐文件没有命中可审核条目。");
  }
}
const recommendationById = new Map(
  recommendationPlan.map((item) => [item.id, item])
);
const requestedIds =
  includeIds.length > 0
    ? includeIds
    : recommendationPlan.map((item) => item.id);

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase
  .from("case_candidates")
  .select(
    "id,title,status,evidence_level,source_platform,source_url,source_metrics_captured_at,creator_name,summary,prompt_preview,prompt_full,media_kind,media_url,poster_url,source_like_count,source_comment_count,source_share_count,source_save_count,tags,created_at"
  )
  .eq("import_batch_id", batch)
  .order("created_at", { ascending: true });

if (error) {
  throw new Error(`读取候选失败：${error.message}`);
}
if (!data?.length) {
  throw new Error(`批次没有候选：${batch}`);
}

const selectedData = filterCandidatesByIds(data, requestedIds);
if (requestedIds.length > 0 && selectedData.length !== requestedIds.length) {
  throw new Error(
    `候选 ID 未完整命中：requested=${requestedIds.length}, found=${selectedData.length}`
  );
}

const queue = buildDailyReviewQueue(selectedData, { limit, maxPerCreator });
if (!queue.rows.length) {
  throw new Error(
    `批次没有可快审候选：pending=${queue.totalPending}, ready=${queue.totalReady}`
  );
}
if (recommendationPlan.length > 0) {
  const recommendationOrder = new Map(
    recommendationPlan.map((item, index) => [item.id, index])
  );
  queue.rows.sort(
    (left, right) =>
      recommendationOrder.get(left.id) - recommendationOrder.get(right.id)
  );
}

const page = renderPage(queue.rows, reviewKey, queue, recommendationById);
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
    `GoodCase 每日快审页：http://127.0.0.1:${port}（${reviewKey}，${queue.rows.length}/${queue.totalPending}，排除 ${queue.totalExcluded}）`
  );
});
