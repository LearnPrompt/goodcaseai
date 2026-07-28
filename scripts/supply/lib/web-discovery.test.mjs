import assert from "node:assert/strict";
import test from "node:test";
import {
  inferWebModel,
  selectWebDiscoveryItems,
} from "./web-discovery.mjs";

function tweet(id, creator, model = "Claude") {
  const prompt = [
    `${model} website result`,
    "Prompt: Build a responsive SaaS website with a hero section, pricing section, testimonials, FAQ, navigation, mobile layout, interactive cards, typography rules, color palette, and animated transitions.",
    "Keep the implementation accessible and include clear component behavior for every section.",
  ]
    .join("\n")
    .padEnd(560, " detail");
  return {
    id_str: id,
    full_text: prompt,
    favorite_count: Number(id),
    reply_count: 1,
    retweet_count: 2,
    bookmark_count: 3,
    user: { screen_name: creator },
    extended_entities: {
      media: [
        {
          id_str: `media-${id}`,
          type: "photo",
          media_url_https: `https://media.example.com/${id}.jpg`,
        },
      ],
    },
  };
}

test("web discovery infers common website builders", () => {
  assert.equal(inferWebModel("Built with Claude Opus"), "Claude");
  assert.equal(inferWebModel("Made in Lovable"), "Lovable");
  assert.equal(inferWebModel("A generic builder"), "AI Web Builder");
});

test("web discovery excludes production URLs and caps repeated creators", () => {
  const rows = [
    tweet("101", "alice"),
    tweet("102", "alice"),
    tweet("103", "alice"),
    tweet("104", "bob", "Gemini"),
  ];
  const selected = selectWebDiscoveryItems(rows, {
    existingUrls: ["https://x.com/alice/status/102"],
    limit: 10,
    maxPerCreator: 2,
  });

  assert.deepEqual(
    selected.map((item) => item.sourceUrl).sort(),
    [
      "https://x.com/alice/status/101",
      "https://x.com/alice/status/103",
      "https://x.com/bob/status/104",
    ]
  );
  assert.ok(selected.every((item) => item.promptText.length >= 500));
});
