#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildFrameTimestamps,
  buildLocalAnalysisPrompt,
  LOCAL_MEDIA_ANALYSIS_SCHEMA,
  parseLocalAnalysis,
} from "./lib/local-media.mjs";

const execFileAsync = promisify(execFile);

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertLoopbackUrl(value) {
  const url = new URL(value);
  const allowed = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!allowed.has(url.hostname)) {
    throw new Error("本地模型地址必须是 localhost、127.0.0.1 或 ::1");
  }
  return url;
}

async function probeDuration(inputPath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("ffprobe 未返回有效视频时长");
  }
  return duration;
}

async function extractFrames(inputPath, outputDir, timestamps) {
  const framePaths = [];
  for (const [index, timestamp] of timestamps.entries()) {
    const framePath = path.join(
      outputDir,
      `frame-${String(index + 1).padStart(2, "0")}.jpg`
    );
    await execFileAsync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      timestamp.toFixed(3),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=960:-2",
      framePath,
    ]);
    framePaths.push(framePath);
  }
  return framePaths;
}

async function callLocalVisionModel({
  baseUrl,
  model,
  framePaths,
  originalPrompt,
}) {
  const images = await Promise.all(
    framePaths.map(async (framePath) => (await readFile(framePath)).toString("base64"))
  );
  const response = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: LOCAL_MEDIA_ANALYSIS_SCHEMA,
      options: { temperature: 0 },
      messages: [
        {
          role: "user",
          content: buildLocalAnalysisPrompt(originalPrompt),
          images,
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `本地模型请求失败：HTTP ${response.status}`);
  }
  return parseLocalAnalysis(payload?.message?.content);
}

async function main() {
  const inputArg = getArg("--input");
  if (!inputArg) {
    throw new Error("缺少 --input=/absolute/or/relative/video.mp4");
  }

  const inputPath = path.resolve(inputArg);
  await access(inputPath);
  const slug = getArg("--slug") || path.parse(inputPath).name;
  const outputDir = path.resolve(
    getArg("--output-dir") || path.join("tmp/local-media-analysis", slug)
  );
  const frameCount = positiveInt(getArg("--frames"), 6);
  const model = getArg("--model") || process.env.OLLAMA_VISION_MODEL || "";
  const promptFile = getArg("--prompt-file");
  const originalPrompt = promptFile
    ? await readFile(path.resolve(promptFile), "utf8")
    : "";

  await mkdir(outputDir, { recursive: true });
  const durationSeconds = await probeDuration(inputPath);
  const timestamps = buildFrameTimestamps(durationSeconds, frameCount);
  const framePaths = await extractFrames(inputPath, outputDir, timestamps);
  const manifest = {
    schemaVersion: 1,
    status: model ? "analyzing" : "frames_ready",
    inputPath,
    durationSeconds,
    timestamps,
    framePaths,
    model: model || null,
    generatedAt: new Date().toISOString(),
  };
  const manifestPath = path.join(outputDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (!model) {
    console.log(`抽帧完成：${manifestPath}`);
    console.log("未提供 --model，仅生成本地帧；没有调用任何模型或外部 API。");
    return;
  }

  const baseUrl = assertLoopbackUrl(
    getArg("--ollama-url") || process.env.OLLAMA_HOST || "http://127.0.0.1:11434"
  );
  const analysis = await callLocalVisionModel({
    baseUrl,
    model,
    framePaths,
    originalPrompt,
  });
  const analysisPath = path.join(outputDir, "analysis.json");
  await writeFile(
    analysisPath,
    `${JSON.stringify(
      { ...manifest, status: "analyzed", analysis },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`本地分析完成：${analysisPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
