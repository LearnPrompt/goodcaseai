#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapSourceSampleToCandidate,
  selectSourceCandidates,
} from "./lib/source-candidate-mapper.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function main() {
  const runDate = getArg("--date", tokyoDate());
  const inputPath = path.resolve(
    APP_DIR,
    getArg(
      "--input",
      `tmp/supply-reports/${runDate}-alternative-source-samples.json`
    )
  );
  const outputPath = path.resolve(
    APP_DIR,
    getArg(
      "--output",
      `tmp/supply-reports/${runDate}-multisource-p1-candidates.json`
    )
  );
  const sourceIds = getArg("--sources", "runninghub,liblib,comfy")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const maxPerSource = Number(getArg("--max-per-source", "5"));
  const report = JSON.parse(await readFile(inputPath, "utf8"));
  if (!Array.isArray(report.items)) {
    throw new Error(`来源报告缺少 items 数组：${inputPath}`);
  }

  const selected = selectSourceCandidates(report.items, {
    sourceIds,
    maxPerSource,
  });
  const candidates = selected.map(mapSourceSampleToCandidate);
  if (!candidates.length) {
    throw new Error("没有满足 Case 证据门的多来源候选");
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");

  const sourceCounts = Object.fromEntries(
    sourceIds.map((sourceId) => [
      sourceId,
      selected.filter((item) => item.sourceId === sourceId).length,
    ])
  );
  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        candidates: candidates.length,
        sourceCounts,
        policy: "L1 pending only; license review and rerun still required",
      },
      null,
      2
    )
  );
}

await main();
