import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TARGET_ORIGIN,
  evaluateReadiness,
  isExpectedLegacyRedirect,
  normalizeOrigin,
  parseArgs,
  stableObservation,
} from "./domain-readiness.mjs";

test("parseArgs keeps migration gates explicit", () => {
  const options = parseArgs([
    "--filing-approved",
    "--wechat-real-device-passed",
    "--stable-since=2026-07-25T00:00:00Z",
    "--phase=post-301",
  ]);

  assert.equal(options.targetOrigin, DEFAULT_TARGET_ORIGIN);
  assert.equal(options.filingApproved, true);
  assert.equal(options.wechatRealDevicePassed, true);
  assert.equal(options.phase, "post-301");
});

test("parseArgs rejects a stability window below 24 hours", () => {
  assert.throws(
    () => parseArgs(["--required-stable-hours=12"]),
    /at least 24/
  );
});

test("normalizeOrigin rejects non-http protocols", () => {
  assert.equal(
    normalizeOrigin("javascript:alert(1)", DEFAULT_TARGET_ORIGIN),
    DEFAULT_TARGET_ORIGIN
  );
});

test("stableObservation requires a valid elapsed window", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");
  const result = stableObservation(
    "2026-07-25T11:00:00Z",
    now,
    24
  );

  assert.equal(result.ok, true);
  assert.equal(result.hours, 25);
});

test("stableObservation does not treat a missing timestamp as stable", () => {
  assert.deepEqual(stableObservation("", Date.now(), 24), {
    ok: false,
    hours: 0,
    reason: "missing --stable-since",
  });
});

test("legacy redirect must preserve path and query", () => {
  assert.equal(
    isExpectedLegacyRedirect({
      legacyUrl: "https://goodcase.ai/cases/example?from=legacy",
      location:
        "https://goodcase.carlwow.com/cases/example?from=legacy",
      targetOrigin: DEFAULT_TARGET_ORIGIN,
    }),
    true
  );
  assert.equal(
    isExpectedLegacyRedirect({
      legacyUrl: "https://goodcase.ai/cases/example?from=legacy",
      location: "https://goodcase.carlwow.com/",
      targetOrigin: DEFAULT_TARGET_ORIGIN,
    }),
    false
  );
});

test("pre-301 readiness still requires filing, real WeChat and stability", () => {
  const result = evaluateReadiness({
    dnsOk: true,
    targetHttpOk: true,
    wechatUaHttpOk: true,
    filingApproved: false,
    wechatRealDevicePassed: false,
    stableObservationOk: false,
    phase: "pre-301",
    legacyRedirectOk: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "filing_approved",
    "wechat_real_device",
    "stable_observation",
  ]);
  assert.equal("legacy_301" in result.checks, false);
});

test("post-301 readiness includes the legacy redirect", () => {
  const result = evaluateReadiness({
    dnsOk: true,
    targetHttpOk: true,
    wechatUaHttpOk: true,
    filingApproved: true,
    wechatRealDevicePassed: true,
    stableObservationOk: true,
    phase: "post-301",
    legacyRedirectOk: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ["legacy_301"]);
});
