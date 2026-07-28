import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStrictWebPost,
  extractStrictWebPrompt,
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

test("strict web discovery isolates one executable website prompt", () => {
  const value = [
    "I built this landing page with Claude and attached the final result.",
    "Exact prompt:",
    "Build a responsive SaaS website with a hero section, feature cards, pricing section, testimonials, FAQ, navigation, and footer.",
    "Use editorial typography, a dark color palette, generous spacing, and a structured grid layout.",
    "Add mobile responsiveness, animated transitions, hover interactions, and an accessible navigation menu.",
  ].join("\n\n");

  const prompt = extractStrictWebPrompt(value);
  assert.match(prompt, /^Build a responsive SaaS website/);
  assert.doesNotMatch(prompt, /I built this/);
});

test("strict web discovery accepts an inline exact prompt and removes result copy", () => {
  const text = [
    "I tested this website builder and attached the final output. Here's my exact prompt:",
    '"Create a modern landing page for a crypto product with a beautiful hero section, 3D elements, pricing table, and a whitelist form."',
    "",
    "What it generated:",
    "A responsive front end with smooth interactions.",
  ].join("\n");
  assert.equal(
    extractStrictWebPrompt(text),
    "Create a modern landing page for a crypto product with a beautiful hero section, 3D elements, pricing table, and a whitelist form."
  );
});

test("strict web discovery removes a trailing public project link", () => {
  const text = [
    "I built this website in one prompt and attached the final result.",
    "Here's the exact prompt I used:",
    "Build a minimal digital agency website with a hero, services, portfolio, about, and contact page.",
    "Use expressive typography, gradient colors, parallax effects, responsive navigation, and hover interactions.",
    "",
    "Here's the public link to the project: https://example.com",
  ].join("\n");
  const prompt = extractStrictWebPrompt(text);
  assert.doesNotMatch(prompt, /public link/);
  assert.doesNotMatch(prompt, /example\.com/);
});

test("strict web discovery rejects lists, tutorials, comparisons and non-web prompts", () => {
  const rejected = [
    [
      "30+ FREE AI Prompt Websites Every Creator Should Bookmark",
      "Prompt: Build a website with a hero, pricing, FAQ, dark colors, responsive layout, and animated transitions.",
      "1. PromptHero\n2. Lexica\n3. OpenArt\n4. Civitai\n5. Krea",
    ].join("\n"),
    [
      "How to build a website in five minutes. Quick guide.",
      "Prompt: Build a responsive portfolio website with hero, projects, about, contact, typography, colors, mobile layout, and hover animations.",
    ].join("\n"),
    [
      "Same prompt, one shot each: Claude vs Kimi model comparison.",
      "Exact prompt: Build a responsive SaaS landing page with hero, pricing, testimonials, FAQ, dark palette, typography, mobile layout, and animations.",
    ].join("\n"),
    [
      "I made this brand identity board.",
      "Prompt template was: Create a brand identity showcase board with logo tiles, packaging, app icons, and landing page fragments.",
    ].join("\n"),
    [
      "Use this prompt to challenge an idea before publishing a landing page.",
      "Use this prompt: Make the strongest possible case against my idea and end with the hardest objection I need to answer.",
    ].join("\n"),
  ];

  assert.ok(rejected.every((value) => extractStrictWebPrompt(value) === ""));
});

test("strict web discovery requires media and a single visible result signal", () => {
  const valid = tweet("201", "alice");
  valid.full_text = [
    "I built this website with Claude. Here is the final result.",
    "Prompt:",
    "Build a responsive portfolio website with a hero section, project cards, about section, contact form, and footer.",
    "Use bold typography, a monochrome color palette, a modular grid layout, and generous spacing.",
    "Add a mobile menu, hover interactions, scroll animations, and responsive breakpoints.",
  ].join("\n\n");
  assert.equal(evaluateStrictWebPost(valid).eligible, true);

  const noResult = structuredClone(valid);
  noResult.full_text = noResult.full_text.replace(
    "I built this website with Claude. Here is the final result.",
    "A useful idea for a future website."
  );
  assert.equal(evaluateStrictWebPost(noResult).eligible, false);

  const noMedia = structuredClone(valid);
  delete noMedia.extended_entities;
  assert.equal(evaluateStrictWebPost(noMedia).eligible, false);
});
