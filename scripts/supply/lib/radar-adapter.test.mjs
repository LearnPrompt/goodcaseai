import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRadarFeed,
  selectDiversifiedItems,
} from "../adapters/radar.mjs";

test("normalizeRadarFeed ranks by relevance, caps output, and preserves AIHot origin", () => {
  const items = normalizeRadarFeed(
    {
      items: [
        {
          id: "low",
          site_id: "official_ai",
          source: "Official",
          title: "Lower score",
          url: "https://example.com/low",
          ai_score: 0.7,
        },
        {
          id: "high",
          site_id: "aihot",
          source: "X：Creator (@creator)",
          title: "Higher score",
          url: "https://x.com/creator/status/123",
          ai_score: 0.95,
        },
        {
          id: "mid",
          site_id: "github",
          source: "GitHub",
          title: "Middle score",
          url: "https://github.com/example/project",
          ai_score: 0.8,
        },
      ],
    },
    { maxItems: 2 }
  );

  assert.deepEqual(
    items.map((item) => item.externalId),
    ["high", "mid"]
  );
  assert.equal(items[0].origin, "aihot");
  assert.equal(items[0].author, "@creator");
});

test("normalizeRadarFeed rejects an incompatible payload", () => {
  assert.throws(
    () => normalizeRadarFeed({ results: [] }),
    /Radar feed 缺少 items 数组/
  );
});

test("selectDiversifiedItems prevents one saturated source from taking every slot", () => {
  const items = [
    ...["news-1", "news-2", "news-3"].map((externalId, index) => ({
      externalId,
      origin: "aibase",
      relevanceScore: 1,
      publishedAt: `2026-07-23T0${9 - index}:00:00Z`,
    })),
    ...["hot-1", "hot-2"].map((externalId, index) => ({
      externalId,
      origin: "aihot",
      relevanceScore: 1,
      publishedAt: `2026-07-23T0${5 - index}:00:00Z`,
    })),
  ];

  const selected = selectDiversifiedItems(items, { maxItems: 4 });

  assert.equal(selected.length, 4);
  assert.equal(selected.filter((item) => item.origin === "aihot").length, 2);
});
