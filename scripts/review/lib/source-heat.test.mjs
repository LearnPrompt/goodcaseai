import test from "node:test";
import assert from "node:assert/strict";
import { scoreSourceHeat } from "../../../src/lib/source-heat.ts";

const completeMetricBase = {
  source: "X / 𝕏",
  sourceUrl: "https://x.com/example/status/1",
  sourcePublishedAt: "2026-07-20T00:00:00.000Z",
  sourceMetricsCapturedAt: "2026-07-21T00:00:00.000Z",
};

test("source heat uses weighted interactions and leaves missing metrics neutral", () => {
  const [item] = scoreSourceHeat([
    {
      ...completeMetricBase,
      sourceLikeCount: 10,
      sourceCommentCount: 2,
      sourceShareCount: 1,
      sourceSaveCount: null,
    },
  ]);

  assert.equal(item.sourceInteractionCount, 13);
  assert.equal(item.sourceWeightedInteractionCount, 17);
  assert.equal(item.sourceMetricsCompleteness, 92.5);
  assert.equal(item.sourceHeatScore, 54);
});

test("source heat ranks engagement within the same platform", () => {
  const [low, high] = scoreSourceHeat([
    {
      ...completeMetricBase,
      sourceLikeCount: 10,
    },
    {
      ...completeMetricBase,
      sourceUrl: "https://x.com/example/status/2",
      sourceLikeCount: 100,
    },
  ]);

  assert.ok((high.sourceHeatScore ?? 0) > (low.sourceHeatScore ?? 0));
});

test("source heat compares different platforms through platform percentiles", () => {
  const items = scoreSourceHeat([
    { ...completeMetricBase, sourceLikeCount: 10 },
    {
      ...completeMetricBase,
      sourceUrl: "https://x.com/example/status/2",
      sourceLikeCount: 20,
    },
    {
      ...completeMetricBase,
      source: "YouTube",
      sourceUrl: "https://youtube.com/watch?v=1",
      sourceLikeCount: 100_000,
    },
  ]);

  assert.equal(items[2].sourceHeatScore, 53);
  assert.ok((items[1].sourceHeatScore ?? 0) > (items[0].sourceHeatScore ?? 0));
});

test("source heat rewards faster interaction accumulation", () => {
  const [oldPost, newPost] = scoreSourceHeat([
    {
      ...completeMetricBase,
      sourcePublishedAt: "2026-07-01T00:00:00.000Z",
      sourceLikeCount: 100,
    },
    {
      ...completeMetricBase,
      sourceUrl: "https://x.com/example/status/2",
      sourcePublishedAt: "2026-07-20T12:00:00.000Z",
      sourceLikeCount: 100,
    },
  ]);

  assert.ok((newPost.sourceHeatScore ?? 0) > (oldPost.sourceHeatScore ?? 0));
});

test("cases without a source metric snapshot do not enter the ranking", () => {
  const [item] = scoreSourceHeat([
    {
      source: "X / 𝕏",
      sourceUrl: "https://x.com/example/status/1",
    },
  ]);

  assert.equal(item.sourceHeatScore, null);
  assert.equal(item.sourceInteractionCount, null);
  assert.match(item.sourceHeatNote, /不参与来源互动榜/);
});
