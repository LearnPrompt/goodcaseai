import assert from "node:assert/strict";
import test from "node:test";
import {
  unescapeDoubleEncodedText,
  buildWebCalibrationReport,
  extractBestMedia,
  extractThreadPrompt,
  mapTweetToReviewItem,
  WEB_CALIBRATION_SEEDS,
  WEB_V2_SEEDS,
  WEB_V3_SEEDS,
  WEB_V4_SEEDS,
} from "./web-calibration.mjs";

function tweet(id, overrides = {}) {
  return {
    id_str: id,
    full_text: "Built this website with an exact prompt.",
    favorite_count: 10,
    bookmark_count: 4,
    reply_count: 2,
    retweet_count: 1,
    views_count: 100,
    user: { screen_name: "alice" },
    entities: {
      media: [
        {
          id_str: "media-1",
          type: "video",
          media_url_https: "https://cdn.example.com/poster.jpg",
          video_info: {
            variants: [
              {
                bitrate: 256000,
                content_type: "video/mp4",
                url: "https://cdn.example.com/low.mp4",
              },
              {
                bitrate: 2176000,
                content_type: "video/mp4",
                url: "https://cdn.example.com/high.mp4",
              },
            ],
          },
        },
      ],
    },
    ...overrides,
  };
}

test("web calibration selects the highest bitrate MP4 and keeps its poster", () => {
  assert.deepEqual(extractBestMedia(tweet("1")), {
    mediaKind: "video",
    mediaUrl: "https://cdn.example.com/high.mp4",
    posterUrl: "https://cdn.example.com/poster.jpg",
  });
});

test("web calibration maps an X post without inventing a prompt", () => {
  const item = mapTweetToReviewItem(tweet("1"), {
    title: "Example",
    sourceId: "x-lovable",
    model: "Lovable",
    methodSignal: true,
    notes: "Direct creator post.",
  });

  assert.equal(item.sourceUrl, "https://x.com/alice/status/1");
  assert.equal(item.creator, "@alice");
  assert.equal(item.mediaKind, "video");
  assert.equal(item.promptText, "");
  assert.equal(item.method, "Built this website with an exact prompt.");
  assert.equal(item.candidateType, "case");
  assert.equal(item.completeness, 0.75);
  assert.equal(item.checks.license, false);
});

test("web calibration can keep a case prompt scoped to the main post", () => {
  const main = tweet("1", {
    full_text:
      "PROMPT:\n\nBuild a responsive robotics landing page with a technical layout, specification section, component animation, and procurement form. ".repeat(
        5
      ),
  });
  const item = mapTweetToReviewItem(
    main,
    {
      title: "Robotics",
      sourceId: "x-mixed",
      model: "Example",
      methodSignal: true,
      promptScope: "main",
      notes: "Keep the main prompt only.",
    },
    [
      main,
      tweet("2", {
        full_text:
          "PROMPT:\n\nCreate a fashion landing page with an editorial layout, responsive components, and runway animation. ".repeat(
            5
          ),
      }),
    ]
  );

  assert.match(item.promptText, /robotics landing page/);
  assert.equal(item.promptText.includes("fashion landing page"), false);
});

test("web calibration extracts a long same-author prompt from the thread", () => {
  const main = tweet("1");
  const thread = [
    main,
    tweet("2", {
      full_text:
        "PROMPT:\n\nBuild a responsive landing page with a cinematic background, editorial typography, reusable sections, responsive components, and scroll animation. ".repeat(
          5
        ),
    }),
    tweet("3", {
      full_text: "Access all prompts here: https://t.co/example",
    }),
  ];

  const prompt = extractThreadPrompt(main, thread);
  assert.match(prompt, /^PROMPT:/);
  assert.match(prompt, /responsive landing page/);
  assert.equal(prompt.includes("t.co"), false);
});

test("web calibration ignores promotional thread replies", () => {
  const main = tweet("1");
  const prompt = extractThreadPrompt(main, [
    main,
    tweet("2", {
      full_text:
        "Access ALL prompts and the full course here: https://t.co/example",
    }),
  ]);
  assert.equal(prompt, "");
});

test("web calibration keeps multiple generated prompts in thread order", () => {
  const main = tweet("1");
  const prompt = extractThreadPrompt(main, [
    main,
    tweet("2", {
      full_text:
        "1/ Grok generated prompt\n\nDesign and build a premium SaaS website with a responsive layout, reusable components, and scroll animation. ".repeat(
          5
        ),
    }),
    tweet("3", {
      full_text:
        "2/ Claude generated prompt\n\nCreate a premium landing page with editorial typography, a responsive component system, and restrained interaction design. ".repeat(
          5
        ),
    }),
  ]);

  assert.match(prompt, /^1\/ Grok generated prompt/);
  assert.match(prompt, /---\n\n2\/ Claude generated prompt/);
});

test("web calibration accepts a complete prompt written in the main post", () => {
  const main = tweet("1", {
    full_text:
      "Here is the exact prompt:\n\nBuild a responsive editorial website with a cinematic background, deliberate typography, reusable sections, accessible components, and restrained scroll animation. ".repeat(
        5
      ),
  });

  const prompt = extractThreadPrompt(main, [main]);
  assert.match(prompt, /^Here is the exact prompt:/);
  assert.match(prompt, /responsive editorial website/);
});

test("web calibration accepts a short but structurally complete main-post prompt", () => {
  const main = tweet("1", {
    full_text:
      'Prompt: Build a responsive landing page for Signal Drift. Include a hero section, email form, curriculum, testimonial carousel, pricing, FAQ, mobile layout, and accessible contrast. Use a clear primary CTA called "Join the waitlist". Keep system fonts, avoid stock photos, and make every form state and navigation interaction work.',
  });

  const prompt = extractThreadPrompt(main, [main]);
  assert.match(prompt, /^Prompt: Build a responsive landing page/);
});

test("web calibration rejects a vague one-line website prompt", () => {
  const main = tweet("1", {
    full_text: 'Prompt: "Build the best website in the world."',
  });

  assert.equal(extractThreadPrompt(main, [main]), "");
});

test("web calibration only accepts curated declarative short prompts when opted in", () => {
  const main = tweet("1", {
    full_text:
      "Prompt: A responsive database platform website for technical teams. Monochrome editorial layout, cobalt accent color, overview and pricing sections, mobile navigation, animated diagrams, accessible contrast, and a working contact form.",
  });

  assert.equal(extractThreadPrompt(main, [main]), "");
  assert.match(
    extractThreadPrompt(main, [main], { allowShortPrompt: true }),
    /^Prompt: A responsive database platform website/
  );
});

test("web calibration accepts short prompts with plural sections and scroll constraints", () => {
  const main = tweet("1", {
    full_text:
      'How I built this website: Prompt: "Build a storytelling website where each scroll section reveals a new chapter with fluid color transitions." Use Three.js for the painted background that reacts to cursor movement. Prompt: "Add GSAP ScrollTrigger so sections animate into view."',
  });

  assert.match(extractThreadPrompt(main, [main]), /storytelling website/);
});

test("web calibration removes a repeated prompt embedded in one reply", () => {
  const body =
    "Build a responsive landing page with a cinematic background, editorial typography, reusable sections, responsive components, and scroll animation. ".repeat(
      5
    );
  const main = tweet("1");
  const prompt = extractThreadPrompt(main, [
    main,
    tweet("2", {
      full_text: `PROMPT:\n\n${body}\n\nHere's the exact prompt to recreate this landing page:\nPROMPT:\n\n${body}`,
    }),
  ]);

  assert.equal((prompt.match(/PROMPT:/g) || []).length, 1);
  assert.equal(prompt.includes("Here's the exact prompt"), false);
});

test("web calibration report preserves the fixed 20-item review order", () => {
  const tweets = WEB_CALIBRATION_SEEDS.map((seed) => tweet(seed.id));
  const threadsById = Object.fromEntries(
    tweets.map((item) => [
      item.id_str,
      [
        item,
        tweet(`${item.id_str}-reply`, {
          full_text:
            "PROMPT:\n\nBuild a responsive website with a clear layout, reusable components, editorial typography, and scroll animation. ".repeat(
              5
            ),
        }),
      ],
    ])
  );
  const report = buildWebCalibrationReport(
    tweets,
    "2026-07-27T12:00:00.000Z",
    threadsById
  );

  assert.equal(report.stats.total, 20);
  assert.equal(report.items.every((item) => item.checks.prompt), true);
  assert.equal(report.items[0].id, `x-${WEB_CALIBRATION_SEEDS[0].id}`);
  assert.equal(report.items.at(-1).id, `x-${WEB_CALIBRATION_SEEDS.at(-1).id}`);
  assert.equal(
    report.sources.reduce((sum, source) => sum + source.collected, 0),
    20
  );
});

test("web calibration report fails closed when a seed is missing", () => {
  const tweets = WEB_CALIBRATION_SEEDS.slice(1).map((seed) => tweet(seed.id));
  assert.throws(
    () => buildWebCalibrationReport(tweets),
    /SocialData 缺少 1 条种子/
  );
});

test("web v2 keeps 20 unique seeds without reusing v1 posts", () => {
  const v1Ids = new Set(WEB_CALIBRATION_SEEDS.map((seed) => seed.id));
  const v2Ids = WEB_V2_SEEDS.map((seed) => seed.id);

  assert.equal(v2Ids.length, 20);
  assert.equal(new Set(v2Ids).size, 20);
  assert.equal(v2Ids.some((id) => v1Ids.has(id)), false);
});

test("web v3 keeps 40 unique seeds without reusing prior review posts", () => {
  const priorIds = new Set(
    [...WEB_CALIBRATION_SEEDS, ...WEB_V2_SEEDS].map((seed) => seed.id)
  );
  const v3Ids = WEB_V3_SEEDS.map((seed) => seed.id);

  assert.equal(v3Ids.length, 40);
  assert.equal(new Set(v3Ids).size, 40);
  assert.equal(v3Ids.some((id) => priorIds.has(id)), false);
});

test("web v4 keeps 40 unique seeds without reusing prior review posts", () => {
  const priorIds = new Set(
    [...WEB_CALIBRATION_SEEDS, ...WEB_V2_SEEDS, ...WEB_V3_SEEDS].map(
      (seed) => seed.id
    )
  );
  const v4Ids = WEB_V4_SEEDS.map((seed) => seed.id);

  assert.equal(v4Ids.length, 40);
  assert.equal(new Set(v4Ids).size, 40);
  assert.equal(v4Ids.some((id) => priorIds.has(id)), false);
});

test("双重编码的多行正文被还原：有字面量换行且零真实换行才动手", () => {
  assert.equal(
    unescapeDoubleEncodedText('line one\\nline two\\nsaid \\"hi\\"'),
    'line one\nline two\nsaid "hi"'
  );
});

test("合法包含 \\n 字面量的代码类 prompt 原样放行", () => {
  // 已有真实换行说明不是双重编码，print('a\\nb') 这类内容不许被改写
  const code = "写一段 Python:\nprint('a\\nb')\nprint('done')";
  assert.equal(unescapeDoubleEncodedText(code), code);
  // 只出现一次字面量也不动（单个 \\n 更可能是内容本身）
  assert.equal(unescapeDoubleEncodedText("escape is \\n here"), "escape is \\n here");
});
