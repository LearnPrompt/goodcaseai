import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  excludeHistoricalItems,
  loadRecentCanonicalKeys,
  loadRunCanonicalKeys,
  rememberCanonicalKeys,
} from "./history.mjs";

test("loadRecentCanonicalKeys includes same-day and recent reports only", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "goodcase-history-"));

  try {
    await Promise.all([
      writeFile(
        path.join(outputDir, "2026-07-23.json"),
        JSON.stringify({ items: [{ canonicalKey: "same-day" }] })
      ),
      writeFile(
        path.join(outputDir, "2026-07-20.json"),
        JSON.stringify({ items: [{ canonicalKey: "recent" }] })
      ),
      writeFile(
        path.join(outputDir, "2026-07-10.json"),
        JSON.stringify({ items: [{ canonicalKey: "stale" }] })
      ),
      writeFile(
        path.join(outputDir, "2026-07-24.json"),
        JSON.stringify({ items: [{ canonicalKey: "future" }] })
      ),
    ]);

    const keys = await loadRecentCanonicalKeys({
      outputDir,
      runDate: "2026-07-23",
      lookbackDays: 7,
    });

    assert.deepEqual([...keys].sort(), ["recent", "same-day"]);
  } finally {
    await rm(outputDir, { recursive: true });
  }
});

test("excludeHistoricalItems separates cross-day repeats from fresh candidates", () => {
  const result = excludeHistoricalItems(
    [{ canonicalKey: "seen" }, { canonicalKey: "new" }],
    new Set(["seen"])
  );

  assert.deepEqual(result.freshItems, [{ canonicalKey: "new" }]);
  assert.equal(result.historicalDuplicates, 1);
});

test("loadRecentCanonicalKeys can exclude the current run date", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "goodcase-days-"));

  try {
    await Promise.all([
      writeFile(
        path.join(outputDir, "2026-07-22.json"),
        JSON.stringify({ items: [{ canonicalKey: "yesterday" }] })
      ),
      writeFile(
        path.join(outputDir, "2026-07-23.json"),
        JSON.stringify({ items: [{ canonicalKey: "today" }] })
      ),
    ]);

    const keys = await loadRecentCanonicalKeys({
      outputDir,
      runDate: "2026-07-23",
      includeRunDate: false,
    });

    assert.deepEqual([...keys], ["yesterday"]);
  } finally {
    await rm(outputDir, { recursive: true });
  }
});

test("loadRunCanonicalKeys only reuses the current report schema", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "goodcase-run-"));
  const reportPath = path.join(outputDir, "2026-07-23.json");

  try {
    await writeFile(
      reportPath,
      JSON.stringify({
        schemaVersion: 2,
        items: [{ canonicalKey: "stable-selection" }],
      })
    );

    assert.deepEqual(
      [...(await loadRunCanonicalKeys(reportPath, { schemaVersion: 2 }))],
      ["stable-selection"]
    );
    assert.equal(
      (await loadRunCanonicalKeys(reportPath, { schemaVersion: 1 })).size,
      0
    );
  } finally {
    await rm(outputDir, { recursive: true });
  }
});

test("rememberCanonicalKeys survives a same-day report overwrite", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "goodcase-ledger-"));

  try {
    await writeFile(
      path.join(outputDir, "2026-07-23.json"),
      JSON.stringify({ items: [{ canonicalKey: "first-run" }] })
    );
    await rememberCanonicalKeys({
      outputDir,
      runDate: "2026-07-23",
      canonicalKeys: ["second-run"],
    });
    await writeFile(
      path.join(outputDir, "2026-07-23.json"),
      JSON.stringify({ items: [{ canonicalKey: "second-run" }] })
    );

    const keys = await loadRecentCanonicalKeys({
      outputDir,
      runDate: "2026-07-23",
    });

    assert.deepEqual([...keys].sort(), ["first-run", "second-run"]);
  } finally {
    await rm(outputDir, { recursive: true });
  }
});
