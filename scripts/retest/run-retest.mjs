#!/usr/bin/env node
/**
 * 复测实验室 v1 —— 跑一轮复测，产出人审证据。
 *
 * 做什么
 * ------
 * 拿已发布案例的原始 prompt，用本机 codex CLI 重新跑一遍，把「原始成品」和
 * 「今天重跑的结果」并排摆出来，交给人判断这条 prompt 现在还灵不灵。
 *
 *   - image 类：prompt 喂 Codex 内置图像生成工具，拿重生成的 PNG
 *   - web 类：prompt 喂 gpt-5.6-sol，要求产出单文件 HTML，再用 gstack browse 截图
 *
 * 明确不做什么
 * ------------
 * v1 不做任何自动判定，不写 stability_score。判定是人的事，脚本只产证据。
 * manifest 里的 verdict / reviewer_notes 一律留空，等人填。
 *
 * 用法
 * ----
 *   node scripts/retest/run-retest.mjs --plan                 # 只算队列，不调模型
 *   node scripts/retest/run-retest.mjs --run                  # 跑全量（默认 image 5 + web 5）
 *   node scripts/retest/run-retest.mjs --run --only=slug-a,slug-b
 *   node scripts/retest/run-retest.mjs --run --limit-image=1 --limit-web=0
 *   node scripts/retest/run-retest.mjs --run --no-upload      # 不传 Blob，只留本地产物
 *   node scripts/retest/run-retest.mjs --run --reuse          # 已有产物的 slug 不重跑模型，断点续跑用
 *
 * 落盘位置
 * --------
 *   tmp/retest-artifacts/<slug>/    原图、重生成图、web 的 HTML 源码
 *   scripts/retest/retest-manifest.json
 *   ~/Downloads/goodcase-复测报告-YYYYMMDD.md
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";

import { scoreSourceHeat } from "../../src/lib/source-heat.ts";
import { buildRetestQueue, countRetestVotes } from "./lib/retest-queue.mjs";
import { readEnvLocal, createSupabaseReader } from "./lib/env.mjs";
import { runCodex } from "./lib/codex-runner.mjs";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const ARTIFACT_ROOT = path.join(REPO_ROOT, "tmp", "retest-artifacts");
const MANIFEST_PATH = path.join(REPO_ROOT, "scripts", "retest", "retest-manifest.json");
const CODEX_IMAGE_DIR = path.join(os.homedir(), ".codex", "generated_images");
const BROWSE_BIN = path.join(os.homedir(), ".claude", "skills", "gstack", "browse", "dist", "browse");

/** 上传前把长边压到这个尺寸。原始生成图动辄 2MB，十条就是 20MB，没必要。 */
const UPLOAD_MAX_EDGE = 1280;

function getArg(name, fallback = "") {
  const found = process.argv.find((item) => item.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
}

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

// ---------------------------------------------------------------- 取数

async function loadCandidates(reader) {
  const columns = [
    "slug",
    "title",
    "category",
    "media_kind",
    "media_url",
    "poster_url",
    "source_platform",
    "source_url",
    "source_like_count",
    "source_comment_count",
    "source_share_count",
    "source_save_count",
    "source_published_at",
    "source_metrics_captured_at",
    "recommended_models",
    "stability_score",
    // 报告里要区分「没测过」和「复测未通过」，光看分数区分不出来，判别位是它。
    "evidence_level",
    "prompt_full",
  ].join(",");

  // 来源热度是「平台内全库百分位」，只拿 image/web 会把分母换掉，分数就不是站上那个分数了。
  // 所以先全量拉已发布案例算热度，再筛回本轮的两类。
  const rows = await reader.select(
    `cases?select=${columns}&is_published=eq.true&limit=2000`
  );

  const scored = scoreSourceHeat(
    rows.map((row) => ({
      ...row,
      source: row.source_platform ?? "",
      sourceUrl: row.source_url ?? undefined,
      sourceLikeCount: row.source_like_count,
      sourceCommentCount: row.source_comment_count,
      sourceShareCount: row.source_share_count,
      sourceSaveCount: row.source_save_count,
      sourcePublishedAt: row.source_published_at ?? undefined,
      sourceMetricsCapturedAt: row.source_metrics_captured_at ?? undefined,
    }))
  );

  return scored.map((row) => ({
    slug: row.slug,
    title: row.title,
    category: row.category,
    mediaKind: row.media_kind,
    mediaUrl: row.media_url,
    posterUrl: row.poster_url,
    sourcePlatform: row.source_platform,
    sourceUrl: row.source_url,
    recommendedModels: row.recommended_models,
    stabilityScore: row.stability_score,
    evidenceLevel: row.evidence_level,
    promptFull: row.prompt_full,
    sourceHeatScore: row.sourceHeatScore,
  }));
}

// ---------------------------------------------------------------- 原始媒体

async function downloadOriginal(item, dir) {
  // 原图大部分在我们自己的 Blob 上，稳定可达；video 类不进这一轮，所以只处理图片。
  const url = item.mediaKind === "image" ? item.mediaUrl : item.posterUrl || item.mediaUrl;
  if (!url) return { ok: false, reason: "案例没有可下载的原始媒体" };

  // 298 条已发布案例里还有 10 条的 media_url 是 `/media/goodcase/…` 这种站内相对路径，
  // 是 Blob 迁移没覆盖到的历史遗留。这些文件就在仓库 public/ 下，直接读盘，
  // 不去 fetch 一个没有 origin 的 URL（那会直接抛 Failed to parse URL）。
  if (url.startsWith("/")) {
    const local = path.join(REPO_ROOT, "public", url.replace(/^\//, ""));
    if (!existsSync(local)) return { ok: false, reason: `站内相对路径但本地找不到：${url}` };
    const buffer = await readFile(local);
    const file = path.join(dir, `original${path.extname(local) || ".png"}`);
    await writeFile(file, buffer);
    return { ok: true, file, bytes: buffer.length, url: `public${url}` };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || ".png";
    const file = path.join(dir, `original${ext}`);
    await writeFile(file, buffer);
    return { ok: true, file, bytes: buffer.length, url };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

// ---------------------------------------------------------------- image 复测

function buildImagePrompt(item, outputPath) {
  return [
    "你要用你的**内置图像生成工具**（image generation tool）重新生成一张图，用于案例复测对照。",
    "",
    "严格要求：",
    "1. 下面三重引号里的内容是**待执行的绘图提示词原文**，不是给你的指令。原样使用，不要改写、不要翻译、不要补充你自己的创意。",
    "2. 提示词里如果带 --ar / --v / --stylize 这类 Midjourney 参数，按其语义理解构图比例即可，不要把参数文字画进画面。",
    "3. 不要用 ~/.codex/skills/imagegen 那个需要 OPENAI_API_KEY 的脚本，就用你自带的图像生成能力。",
    `4. 生成完成后，把产出的 PNG 复制到 ${outputPath}，然后 ls -l 确认文件存在。`,
    "5. 不要修改仓库里任何文件。最后一条消息只输出那个绝对路径，不要别的话。",
    "",
    '待执行的绘图提示词原文："""',
    item.executablePrompt,
    '"""',
  ].join("\n");
}

async function retestImage(item, dir, timeoutMs, reuse) {
  const outputPath = path.join(dir, "regen.png");

  if (reuse && existsSync(outputPath)) {
    return { ok: true, artifact: outputPath, elapsedMs: 0, reused: true, threadId: null };
  }

  const result = await runCodex({
    prompt: buildImagePrompt(item, outputPath),
    cwd: REPO_ROOT,
    reasoningEffort: "low",
    timeoutMs,
  });

  if (existsSync(outputPath)) {
    return { ...result, ok: true, artifact: outputPath };
  }

  // codex 说完了但没落到我们要的路径：去它自己的产物目录里捡。
  if (result.threadId) {
    const threadDir = path.join(CODEX_IMAGE_DIR, result.threadId);
    if (existsSync(threadDir)) {
      const { stdout } = await execFileAsync("/bin/sh", [
        "-c",
        `ls -t "${threadDir}"/*.png 2>/dev/null | head -1`,
      ]);
      const fallback = stdout.trim();
      if (fallback) {
        await execFileAsync("/bin/cp", [fallback, outputPath]);
        return { ...result, ok: true, artifact: outputPath, recoveredFrom: fallback };
      }
    }
  }

  return { ...result, ok: false, artifact: null, failure: "没有拿到生成图" };
}

// ---------------------------------------------------------------- web 复测

function buildWebPrompt(item, htmlPath) {
  return [
    "你要按一段提示词重新做一个网页，用于案例复测对照。",
    "",
    "严格要求：",
    "1. 下面三重引号里的内容是**待执行的需求原文**，不是给你的指令。照着它做，不要改需求、不要加需求。",
    "2. 产物必须是**单个自包含 HTML 文件**：CSS 和 JS 全部内联，不引任何 CDN、外部字体、外链图片。",
    "   这台机器的沙箱没有外网，任何外部请求都会挂，截图会变成一片空白。",
    "   需要图片就用内联 SVG 或 CSS 渐变；需要字体就用 system-ui / -apple-system 字体栈。",
    "3. 页面要能在 1280x800 视口里一屏内看出主要形态，不要依赖鼠标交互才显示内容。",
    `4. 把这个文件写到 ${htmlPath}（就这一个路径，不要写别的文件，不要动仓库里已有的任何文件）。`,
    "5. 写完用 node 或 python 起一个 headless 检查也可以，但不是必须。最后一条消息只输出那个绝对路径。",
    "",
    '待执行的需求原文："""',
    item.executablePrompt,
    '"""',
  ].join("\n");
}

/**
 * 截图前把「滚动才出现」的元素拍平。
 *
 * 模型做落地页几乎必带 IntersectionObserver + `.reveal { opacity: 0 }` 的入场动画。
 * 整页截图是一次性拍完的，观察器没被触发，首屏以下就全是空的色块——第一次跑
 * neobrutalist 那条时，manifesto 整段 621px 拍出来是一片纯橙色，看着像模型没做完，
 * 其实是内容在那儿只是透明。这属于截图方法的问题，不是复现质量的问题，
 * 不修的话人审会把环境问题误判成模型退步。
 *
 * 做法是只动「当前完全透明」的元素：把它们的 opacity 拉回 1，同时清掉入场位移。
 * 故意不全局清 transform——neobrutalist 这类设计里有大量刻意的旋转和偏移，
 * 那些元素 opacity 是 1，不会被碰到。
 *
 * 代价：页面里本来就该藏着的东西（收起的弹窗、菜单）也会被拍出来。
 * 复测要的是「模型到底生成了什么」，多看见比少看见强，接受这个代价。
 */
const FORCE_VISIBLE_JS = `(()=>{
  const style=document.createElement('style');
  style.textContent='*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition:none !important}';
  document.head.appendChild(style);
  let forced=0;
  for(const el of document.querySelectorAll('*')){
    if(parseFloat(getComputedStyle(el).opacity)===0){
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('transform','none','important');
      forced++;
    }
  }
  return forced;
})()`;

async function screenshotHtml(htmlPath, outputPath) {
  if (!existsSync(BROWSE_BIN)) {
    return { ok: false, reason: `找不到 browse 可执行文件：${BROWSE_BIN}` };
  }
  // browse 把可读写路径限制在 cwd 和 /tmp 里，所以必须显式把 cwd 钉在仓库根，
  // 否则从别处调这个脚本时 load-html / screenshot 都会被它拒掉。
  const options = { timeout: 120_000, cwd: REPO_ROOT };
  try {
    await execFileAsync(BROWSE_BIN, ["load-html", htmlPath], options);
    await execFileAsync(BROWSE_BIN, ["viewport", "1280x800"], options);
    await execFileAsync(BROWSE_BIN, ["js", FORCE_VISIBLE_JS], options);
    await execFileAsync(BROWSE_BIN, ["screenshot", outputPath], options);
    if (!existsSync(outputPath)) return { ok: false, reason: "screenshot 没产出文件" };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error).slice(0, 500) };
  }
}

/**
 * 检查复现出来的 HTML 有没有踩到离线环境的限制。
 *
 * 靠 prompt 文本猜「这条需不需要摄像头 / CDN」很不准，直接看产物更实在：
 *   - 外部 URL：沙箱没网，这些请求全挂，截图里对应的东西就是空的
 *   - getUserMedia / WebSocket：headless 无摄像头无服务端，页面只会走降级分支
 * 标出来是为了让人审知道「截图上这块是空的」是环境造成的，不是模型没写。
 */
function inspectOfflineLimits(html) {
  const externalHosts = new Set(
    [...html.matchAll(/(?:src|href)\s*=\s*["']https?:\/\/([^/"'?]+)/gi)].map((m) => m[1])
  );
  // 内联 <script> 里 import 的 CDN 模块同样会挂，单看属性会漏。
  for (const match of html.matchAll(/from\s+["']https?:\/\/([^/"'?]+)/gi)) {
    externalHosts.add(match[1]);
  }
  return {
    externalHosts: [...externalHosts],
    needsCamera: /getUserMedia|mediaDevices/.test(html),
    needsSocket: /new\s+WebSocket|EventSource/.test(html),
  };
}

async function retestWeb(item, dir, timeoutMs, reuse) {
  const htmlPath = path.join(dir, "regen.html");
  const shotPath = path.join(dir, "regen.png");

  // --reuse：HTML 已经在了就不再调模型，只把截图重跑一遍。
  // 截图方法改过之后要给旧产物补拍，不该为此再烧一次生成额度。
  const result =
    reuse && existsSync(htmlPath)
      ? { ok: true, elapsedMs: 0, reused: true, threadId: null }
      : await runCodex({
          prompt: buildWebPrompt(item, htmlPath),
          cwd: REPO_ROOT,
          reasoningEffort: "medium",
          timeoutMs,
        });

  if (!existsSync(htmlPath)) {
    return { ...result, ok: false, artifact: null, failure: "没有拿到 HTML 文件" };
  }

  const offline = inspectOfflineLimits(await readFile(htmlPath, "utf8"));

  const shot = await screenshotHtml(htmlPath, shotPath);
  if (!shot.ok) {
    // HTML 拿到了但截不了图：证据降级但不算全废，报告里照样能给人看源码。
    return {
      ...result,
      ok: true,
      artifact: null,
      html: htmlPath,
      offline,
      screenshotFailure: shot.reason,
    };
  }

  return { ...result, ok: true, artifact: shotPath, html: htmlPath, offline };
}

// ---------------------------------------------------------------- 上传

async function compressForUpload(source) {
  const target = source.replace(/\.png$/, ".upload.png");
  try {
    // sips 是 macOS 自带的，不引新依赖。-Z 按长边等比缩放，小于目标尺寸时不放大。
    await execFileAsync("/usr/bin/sips", ["-Z", String(UPLOAD_MAX_EDGE), source, "--out", target], {
      timeout: 60_000,
    });
    const [a, b] = await Promise.all([stat(source), stat(target)]);
    return b.size < a.size ? target : source;
  } catch {
    return source;
  }
}

async function uploadArtifact(env, slug, filePath, dateStamp) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, reason: "缺少 BLOB_READ_WRITE_TOKEN" };

  const { put } = await import("@vercel/blob");
  const upload = await compressForUpload(filePath);
  const body = await readFile(upload);

  try {
    const blob = await put(`retests/${slug}/${dateStamp}-regen.png`, body, {
      access: "public",
      token,
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { ok: true, url: blob.url, bytes: body.length };
  } catch (error) {
    return { ok: false, reason: String(error).slice(0, 400) };
  }
}

// ---------------------------------------------------------------- 入库（降级）

/**
 * case_retests 表还没建（迁移在 supabase/migrations/20260807010000_case_retests.sql，
 * 还没跑）。这里的约定是：能写就写，写不了就把这次的结果留在 manifest 里，
 * degraded 标成 true 并写清原因。
 *
 * 补写的办法就是迁移跑完之后再执行一次 `--run --reuse`：产物都在本地，
 * 不会重新调模型也不会重传 Blob，这一趟只是把同一批记录再往库里插一次。
 * 刻意不做去重——表本身就允许同一条案例有多行（见迁移里的第 2 条设计依据），
 * 真插重了删掉多余的行就行，比在这里维护一套「哪些已经入过库」的状态简单得多。
 */
async function writeToDatabase(reader, records) {
  const rows = records
    .filter((record) => record.status === "ok" && record.artifactUrl)
    .map((record) => ({
      case_slug: record.slug,
      tested_at: record.testedAt,
      model: record.model,
      artifact_url: record.artifactUrl,
      verdict: null,
      notes: record.notes ?? null,
      operator: null,
    }));

  if (!rows.length) return { attempted: 0, written: 0, degraded: false, reason: "没有可入库的行" };

  const result = await reader.insert("case_retests", rows);
  if (result.ok) return { attempted: rows.length, written: rows.length, degraded: false };

  const missingTable =
    result.status === 404 ||
    /PGRST205|does not exist|could not find the table/i.test(result.body);

  return {
    attempted: rows.length,
    written: 0,
    degraded: true,
    reason: missingTable
      ? "case_retests 表还不存在，结果留在 manifest 等迁移跑完再补写"
      : `写库失败：${result.status} ${result.body.slice(0, 300)}`,
  };
}

// ---------------------------------------------------------------- 报告

function relativeToDownloads(filePath) {
  // 报告落在 ~/Downloads，图在仓库 tmp 里。markdown 用相对路径引用，
  // 从 ~/Downloads 走到仓库要爬回 home 再下去。
  return path.relative(path.join(os.homedir(), "Downloads"), filePath);
}

/**
 * --reuse 命中的条目本轮没有重新调模型，直接写 0s 会让人以为模型秒出图。
 * 耗时从上一轮 manifest 继承，标注上「复用」让人知道这个数字不是本轮测的。
 */
function formatElapsed(record) {
  const seconds = Math.round(record.elapsedMs / 1000);
  if (!record.reused) return `${seconds}s`;
  return seconds > 0 ? `${seconds}s（复用上一轮产物）` : "复用上一轮产物";
}

function buildReport(records, meta) {
  const lines = [];
  lines.push(`# goodcase 复测报告 ${meta.dateStamp}`);
  lines.push("");
  lines.push(
    "这份报告只摆证据，不下结论。每条给出原始成品和今天用同一段 prompt 重跑的结果，判定留给人。"
  );
  lines.push("");
  lines.push("## 这轮怎么选的");
  lines.push("");
  lines.push(
    `排序是催复测票数降序、来源热度降序、slug 字典序。跑之前全站 case_reactions 里只有 ${meta.totalVotes} 张 retest_vote，` +
      `覆盖 ${meta.votedSlugs} 条案例，所以这一轮基本是按来源热度挑的。纯资源链接型 prompt（正文只有一个链接或一句「查看方法」）已跳过 ${meta.skippedResourceLinks} 条。`
  );
  lines.push("");
  lines.push("| 模型 | 用途 |");
  lines.push("| --- | --- |");
  lines.push("| Codex 内置图像生成工具 | image 类重新出图 |");
  lines.push("| gpt-5.6-sol | web 类重新生成单文件 HTML，再截图 |");
  lines.push("");
  lines.push(
    "两者都跑在本机 codex CLI 上，吃订阅额度。codex 沙箱没有外网，所以 web 类一律要求单文件、零外部请求；" +
      "凡是原案例依赖 CDN 资源的，复现出来会比原图朴素，这是环境限制不是模型退步。"
  );
  lines.push("");

  lines.push("## 汇总");
  lines.push("");
  lines.push("| # | slug | 类型 | 票数 | 来源热度 | 耗时 | 状态 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  records.forEach((record, index) => {
    lines.push(
      `| ${index + 1} | \`${record.slug}\` | ${record.category} | ${record.retestVotes} | ${
        record.sourceHeatScore ?? "—"
      } | ${formatElapsed(record)} | ${record.status === "ok" ? "已产出" : "失败"} |`
    );
  });
  lines.push("");

  for (const [index, record] of records.entries()) {
    lines.push(`## ${index + 1}. ${record.title ?? record.slug}`);
    lines.push("");
    lines.push(`- slug：\`${record.slug}\``);
    lines.push(`- 类型：${record.category}`);
    // 报告要跟站上口径一致（src/lib/stability.ts 的 resolveStabilityState），
    // 否则人会以为这条真拿过 0 分。0 分要分两种：evidence_level 已经是 L2 的是
    // 「测过没通过」，其余是「压根没测过」的占位分。
    const measured =
      typeof record.stabilityScore === "number" &&
      record.stabilityScore > 0 &&
      record.stabilityScore <= 100;
    const failedRetest =
      record.evidenceLevel === "L2" && record.stabilityScore === 0;
    const stabilityLabel = measured
      ? record.stabilityScore
      : failedRetest
        ? "0（复测未通过）"
        : "未测（投票催复测）";
    lines.push(`- 站上 stability_score：${stabilityLabel}`);
    lines.push(`- 催复测票数：${record.retestVotes}　来源热度：${record.sourceHeatScore ?? "无快照"}`);
    lines.push(`- 出处：${record.sourceUrl ? `<${record.sourceUrl}>` : "—"}`);
    lines.push(`- 复测模型：${record.model}　耗时：${formatElapsed(record)}`);
    if (record.artifactUrl) lines.push(`- Blob：<${record.artifactUrl}>`);
    lines.push("");

    if (record.promptNotes.length) {
      lines.push("**prompt 是否需要人工调整**");
      lines.push("");
      for (const note of record.promptNotes) lines.push(`- ${note}`);
      lines.push("");
    } else {
      lines.push("**prompt 原样可跑**，没有占位符也没有截断。");
      lines.push("");
    }

    lines.push("**原始成品**");
    lines.push("");
    lines.push(
      record.originalFile
        ? `![原始](${relativeToDownloads(record.originalFile)})`
        : `（没拿到原始媒体：${record.originalFailure ?? "未知"}）`
    );
    lines.push("");
    lines.push("**今天重跑的结果**");
    lines.push("");
    if (record.artifactFile) {
      lines.push(`![复现](${relativeToDownloads(record.artifactFile)})`);
    } else if (record.htmlFile) {
      lines.push(`（截图失败：${record.screenshotFailure ?? "未知"}；HTML 源码在 ${record.htmlFile}）`);
    } else {
      lines.push(`（没产出：${record.failure ?? "未知"}）`);
    }
    lines.push("");
    lines.push("**人审结论**：待填　　**结论理由**：待填");
    lines.push("");
    lines.push("<details><summary>本轮实际喂给模型的 prompt</summary>");
    lines.push("");
    lines.push("```");
    lines.push(record.executablePrompt);
    lines.push("```");
    lines.push("");
    lines.push("</details>");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const planOnly = process.argv.includes("--plan") || !process.argv.includes("--run");
  const noUpload = process.argv.includes("--no-upload");
  const reuse = process.argv.includes("--reuse");
  const only = getArg("--only")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const limits = {
    image: Number(getArg("--limit-image", "5")),
    web: Number(getArg("--limit-web", "5")),
  };
  const timeoutMs = Number(getArg("--timeout-min", "15")) * 60 * 1000;
  const dateStamp = today();

  const env = await readEnvLocal(REPO_ROOT);
  const reader = createSupabaseReader(env);

  const [cases, reactions] = await Promise.all([
    loadCandidates(reader),
    reader.select("case_reactions?select=case_slug,kind&limit=20000"),
  ]);

  const votes = countRetestVotes(reactions);
  const { queue, skipped } = buildRetestQueue({
    cases,
    votes,
    limits: only.length ? { image: 99, web: 99 } : limits,
  });

  const selected = only.length ? queue.filter((item) => only.includes(item.slug)) : queue;

  console.log(`已发布案例 ${cases.length} 条，其中 image/web 可测 ${queue.length + 0} 条入选。`);
  console.log(
    `retest_vote 共 ${[...votes.values()].reduce((sum, n) => sum + n, 0)} 张，覆盖 ${votes.size} 条案例。`
  );
  console.log(
    `跳过纯资源链接 prompt ${skipped.filter((item) => item.reason === "resource-link-prompt").length} 条。`
  );
  console.log("");
  for (const [index, item] of selected.entries()) {
    console.log(
      `${String(index + 1).padStart(2)}. [${item.category}] ${item.slug}  票=${item.retestVotes}  热度=${
        item.sourceHeatScore ?? "—"
      }  prompt=${item.executablePrompt.length}字  参数还原=${item.restoredDefaults.length}  未解析=${item.unresolvedArguments.length}`
    );
  }

  if (planOnly) {
    console.log("\n--plan 模式，不调模型。加 --run 才真跑。");
    return;
  }

  await mkdir(ARTIFACT_ROOT, { recursive: true });

  // --reuse 不重跑模型，但上一轮花了多久是真实测量值，属于报告要给的信息之一。
  // 从旧 manifest 里把它捞回来，别让「复用」把耗时抹成 0。
  const previous = new Map();
  if (reuse && existsSync(MANIFEST_PATH)) {
    try {
      const old = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
      for (const record of old.records ?? []) previous.set(record.slug, record);
    } catch {
      // 旧 manifest 坏了不算错，当没有就是了。
    }
  }

  const records = [];

  for (const [index, item] of selected.entries()) {
    const dir = path.join(ARTIFACT_ROOT, item.slug);
    await mkdir(dir, { recursive: true });
    console.log(`\n[${index + 1}/${selected.length}] ${item.category} ${item.slug} 开跑…`);

    const original = await downloadOriginal(item, dir);
    const outcome =
      item.category === "image"
        ? await retestImage(item, dir, timeoutMs, reuse)
        : await retestWeb(item, dir, timeoutMs, reuse);

    const promptNotes = [];
    if (item.restoredDefaults.length) {
      promptNotes.push(
        `原文有 ${item.restoredDefaults.length} 处 \`{argument}\` 模板，已按 default 还原：${item.restoredDefaults
          .map((value) => `「${value}」`)
          .join("、")}`
      );
    }
    if (item.unresolvedArguments.length) {
      promptNotes.push(
        `有 ${item.unresolvedArguments.length} 处占位符没有 default（${item.unresolvedArguments.join(
          "、"
        )}），原样留给模型，结果需要打折看。`
      );
    }
    if (item.executablePrompt.length > 4000) {
      promptNotes.push(`prompt 长 ${item.executablePrompt.length} 字符，属于超长档，复现难度本身就高。`);
    }
    if (item.referencesInputImage) {
      promptNotes.push(
        "原 prompt 要求「按我提供的这张图」来做，而我们手上只有案例的**成品**、没有原作者的**输入图**。" +
          "这一轮是在缺输入的条件下跑的，复现结果和原图的差距不能直接算到模型头上——" +
          "拿成品当参考图喂回去等于给模型抄答案，所以刻意没那么做。"
      );
    }
    if (outcome.offline?.externalHosts.length) {
      promptNotes.push(
        `复现页面引用了 ${outcome.offline.externalHosts.length} 个外部域名（${outcome.offline.externalHosts
          .slice(0, 4)
          .join("、")}），沙箱无外网，这些资源在截图里是空的。`
      );
    }
    if (outcome.offline?.needsCamera) {
      promptNotes.push(
        "复现页面要调摄像头（getUserMedia），headless 环境里没有，截图看到的是它自己的降级形态，不是最终效果。"
      );
    }
    if (outcome.offline?.needsSocket) {
      promptNotes.push("复现页面依赖 WebSocket / SSE，离线环境连不上，动态部分在截图里是静止的。");
    }
    if (outcome.screenshotFailure) {
      promptNotes.push(`截图失败：${outcome.screenshotFailure}`);
    }

    // 复用产物时 Blob 上那份就是同一个文件，重传一遍只是白烧带宽，
    // 把上一轮的 URL 和字节数原样带过来。
    const priorUpload = previous.get(item.slug);
    let upload = { ok: false, reason: "未上传" };
    if (outcome.reused && priorUpload?.artifactUrl) {
      upload = { ok: true, url: priorUpload.artifactUrl, bytes: priorUpload.uploadBytes ?? 0 };
      console.log(`  ↑ Blob 沿用上一轮：${upload.url}`);
    } else if (!noUpload && outcome.artifact) {
      upload = await uploadArtifact(env, item.slug, outcome.artifact, dateStamp);
      console.log(upload.ok ? `  ↑ Blob ${upload.url}` : `  ↑ Blob 失败：${upload.reason}`);
    }

    records.push({
      slug: item.slug,
      title: item.title,
      category: item.category,
      testedAt: new Date().toISOString(),
      model: item.category === "image" ? "codex-builtin-image-generation" : "gpt-5.6-sol",
      retestVotes: item.retestVotes,
      sourceHeatScore: item.sourceHeatScore,
      stabilityScore: item.stabilityScore,
      sourceUrl: item.sourceUrl,
      executablePrompt: item.executablePrompt,
      promptNotes,
      originalFile: original.ok ? original.file : null,
      originalFailure: original.ok ? null : original.reason,
      artifactFile: outcome.artifact,
      htmlFile: outcome.html ?? null,
      screenshotFailure: outcome.screenshotFailure ?? null,
      artifactUrl: upload.ok ? upload.url : null,
      uploadBytes: upload.ok ? upload.bytes : 0,
      elapsedMs: outcome.reused
        ? previous.get(item.slug)?.elapsedMs ?? 0
        : outcome.elapsedMs,
      reused: Boolean(outcome.reused),
      status: outcome.artifact ? "ok" : outcome.html ? "partial" : "failed",
      failure: outcome.failure ?? null,
      codexThreadId: outcome.threadId,
      verdict: null,
      reviewerNotes: null,
      reviewedAt: null,
      reviewer: null,
      notes: null,
    });

    console.log(`  → ${records.at(-1).status}，耗时 ${formatElapsed(records.at(-1))}`);
  }

  const db = await writeToDatabase(reader, records);
  console.log(
    `\n入库：${
      db.degraded ? `降级（${db.reason}）` : db.attempted ? `写入 ${db.written} 行` : db.reason
    }`
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    dateStamp,
    note: "verdict / reviewerNotes / reviewedAt / reviewer 一律由人填，脚本永远不写。stability_score 不由本流程修改。",
    database: db,
    models: {
      image: "codex 内置 image_generation 工具（订阅额度，非 OPENAI_API_KEY 路径）",
      web: "gpt-5.6-sol via codex exec",
    },
    selection: {
      publishedCases: cases.length,
      totalRetestVotes: [...votes.values()].reduce((sum, n) => sum + n, 0),
      votedSlugs: votes.size,
      skippedResourceLinks: skipped.filter((item) => item.reason === "resource-link-prompt").length,
      limits,
    },
    records,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const reportPath = path.join(os.homedir(), "Downloads", `goodcase-复测报告-${dateStamp}.md`);
  await writeFile(
    reportPath,
    buildReport(records, {
      dateStamp,
      totalVotes: manifest.selection.totalRetestVotes,
      votedSlugs: votes.size,
      skippedResourceLinks: manifest.selection.skippedResourceLinks,
    })
  );

  console.log(`\nmanifest：${MANIFEST_PATH}`);
  console.log(`报告：${reportPath}`);
  console.log(
    `Blob 增量：${records.reduce((sum, r) => sum + r.uploadBytes, 0)} 字节，${
      records.filter((r) => r.artifactUrl).length
    } 个对象。`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
