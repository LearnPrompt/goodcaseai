import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEDGER_FILE = "seen-keys.json";

function dayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / DAY_MS);
}

async function loadRecentEntries({
  outputDir,
  runDate,
  lookbackDays = 7,
  includeRunDate = true,
}) {
  const runDay = dayNumber(runDate);
  if (runDay === null) {
    throw new Error(`无效 runDate：${runDate}`);
  }

  let entries;
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      entries = [];
    } else {
      throw error;
    }
  }

  const entriesByKey = new Map();
  try {
    const ledger = JSON.parse(
      await readFile(path.join(outputDir, LEDGER_FILE), "utf8")
    );
    for (const item of Array.isArray(ledger.entries) ? ledger.entries : []) {
      const seenDay = dayNumber(item.seenOn);
      if (
        typeof item.canonicalKey === "string" &&
        item.canonicalKey !== "" &&
        seenDay !== null &&
        seenDay <= runDay - (includeRunDate ? 0 : 1) &&
        seenDay >= runDay - lookbackDays
      ) {
        entriesByKey.set(item.canonicalKey, item.seenOn);
      }
    }
  } catch {
    // The dated reports below remain the recovery source for the ledger.
  }

  const reportFiles = entries.filter((entry) => {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      return false;
    }
    const reportDay = dayNumber(entry.name.slice(0, -5));
    return (
      reportDay !== null &&
      reportDay <= runDay - (includeRunDate ? 0 : 1) &&
      reportDay >= runDay - lookbackDays
    );
  });

  for (const entry of reportFiles) {
    try {
      const reportDate = entry.name.slice(0, -5);
      const report = JSON.parse(
        await readFile(path.join(outputDir, entry.name), "utf8")
      );
      for (const item of Array.isArray(report.items) ? report.items : []) {
        if (typeof item.canonicalKey === "string" && item.canonicalKey !== "") {
          const previousDate = entriesByKey.get(item.canonicalKey);
          if (!previousDate || previousDate < reportDate) {
            entriesByKey.set(item.canonicalKey, reportDate);
          }
        }
      }
    } catch {
      // A damaged historical report must not block a new shadow run.
    }
  }

  return entriesByKey;
}

export async function loadRecentCanonicalKeys(options) {
  return new Set((await loadRecentEntries(options)).keys());
}

export async function loadRunCanonicalKeys(jsonPath, { schemaVersion } = {}) {
  try {
    const report = JSON.parse(await readFile(jsonPath, "utf8"));
    if (
      schemaVersion !== undefined &&
      Number(report.schemaVersion) !== Number(schemaVersion)
    ) {
      return new Set();
    }
    return new Set(
      (Array.isArray(report.items) ? report.items : [])
        .map((item) => item.canonicalKey)
        .filter((key) => typeof key === "string" && key !== "")
    );
  } catch {
    return new Set();
  }
}

export async function rememberCanonicalKeys({
  outputDir,
  runDate,
  canonicalKeys,
  lookbackDays = 7,
}) {
  const entriesByKey = await loadRecentEntries({
    outputDir,
    runDate,
    lookbackDays,
    includeRunDate: true,
  });

  for (const canonicalKey of canonicalKeys) {
    if (typeof canonicalKey === "string" && canonicalKey !== "") {
      entriesByKey.set(canonicalKey, runDate);
    }
  }

  const entries = [...entriesByKey]
    .map(([canonicalKey, seenOn]) => ({ canonicalKey, seenOn }))
    .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, LEDGER_FILE),
    `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`,
    "utf8"
  );
}

export function excludeHistoricalItems(items, historicalKeys) {
  const freshItems = [];
  let historicalDuplicates = 0;

  for (const item of items) {
    if (historicalKeys.has(item.canonicalKey)) {
      historicalDuplicates += 1;
    } else {
      freshItems.push(item);
    }
  }

  return { freshItems, historicalDuplicates };
}
