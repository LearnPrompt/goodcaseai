#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWebCalibrationReport,
  WEB_CALIBRATION_SEEDS,
  WEB_V2_SEEDS,
  WEB_V3_SEEDS,
  WEB_V4_SEEDS,
} from "./lib/web-calibration.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const batch =
  process.argv.find((value) => value.startsWith("--batch="))?.slice(8) || "v1";
if (!["v1", "v2", "v3", "v4"].includes(batch)) {
  throw new Error(`不支持的 batch：${batch}`);
}
const seedsByBatch = {
  v1: WEB_CALIBRATION_SEEDS,
  v2: WEB_V2_SEEDS,
  v3: WEB_V3_SEEDS,
  v4: WEB_V4_SEEDS,
};
const titleByBatch = {
  v1: "网页榜 V1 校准",
  v2: "网页榜 V2 校准",
  v3: "网页榜 V3 校准",
  v4: "网页榜 V4 校准",
};
const seeds = seedsByBatch[batch];
const outputPath = path.resolve(
  APP_DIR,
  process.argv.find((value) => value.startsWith("--out="))?.slice(6) ||
    `tmp/supply-reports/2026-07-27-web-${batch}-calibration.json`
);

const apiKey = process.env.SOCIALDATA_API_KEY;
if (!apiKey) {
  throw new Error(
    "缺少 SOCIALDATA_API_KEY。请用 node --env-file=.env.local 运行此脚本。"
  );
}

const response = await fetch(
  "https://api.socialdata.tools/twitter/tweets-by-ids",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ids: seeds.map((seed) => seed.id),
    }),
  }
);
const payload = await response.json();
if (!response.ok) {
  throw new Error(
    `SocialData 请求失败 (${response.status})：${
      payload.message || payload.error || "unknown error"
    }`
  );
}

const tweets = Array.isArray(payload)
  ? payload
  : payload.tweets || payload.data || [];

const threadsById = {};
for (let start = 0; start < seeds.length; start += 5) {
  const seedBatch = seeds.slice(start, start + 5);
  const threadResults = await Promise.all(
    seedBatch.map(async (seed) => {
      const threadResponse = await fetch(
        `https://api.socialdata.tools/twitter/thread/${seed.id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );
      const threadPayload = await threadResponse.json();
      if (!threadResponse.ok) {
        throw new Error(
          `SocialData thread 请求失败 ${seed.id} (${threadResponse.status})：${
            threadPayload.message || threadPayload.error || "unknown error"
          }`
        );
      }
      return [
        seed.id,
        Array.isArray(threadPayload)
          ? threadPayload
          : threadPayload.tweets || threadPayload.data || [],
      ];
    })
  );
  Object.assign(threadsById, Object.fromEntries(threadResults));
}

const report = buildWebCalibrationReport(
  tweets,
  new Date().toISOString(),
  threadsById,
  {
    seeds,
    title: titleByBatch[batch],
  }
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      output: outputPath,
      total: report.stats.total,
      cases: report.stats.cases,
      topicSeeds: report.stats.topicSeeds,
      promptsCaptured: report.items.filter((item) => item.checks.prompt).length,
      sources: report.sources.map((source) => ({
        id: source.id,
        collected: source.collected,
      })),
    },
    null,
    2
  )
);
