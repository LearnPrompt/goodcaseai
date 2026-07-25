import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCandidateDedupeKey,
  slugifyCandidate,
} from "./candidate-slug.mjs";

test("slugifyCandidate keeps ASCII titles readable", () => {
  assert.equal(
    slugifyCandidate("Luxury Skincare Commercial"),
    "luxury-skincare-commercial"
  );
});

test("slugifyCandidate makes Chinese titles deterministic and ASCII-safe", () => {
  const first = slugifyCandidate(
    "奢华护肤品广告",
    "https://x.com/i/status/2077666970707890376"
  );
  const second = slugifyCandidate(
    "奢华护肤品广告",
    "https://x.com/i/status/2077666970707890376"
  );

  assert.equal(first, second);
  assert.match(first, /^case-[a-f0-9]{12}$/);
  assert.match(first, /^[a-z0-9-]+$/);
});

test("source URL is the primary dedupe identity", () => {
  const left = buildCandidateDedupeKey({
    slug: "first-title",
    source_url: "https://x.com/i/status/123",
  });
  const right = buildCandidateDedupeKey({
    slug: "renamed-title",
    source_url: "https://x.com/i/status/123",
  });

  assert.equal(left, right);
  assert.match(left, /^source:[a-f0-9]{12}$/);
});
