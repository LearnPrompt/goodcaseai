import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsInsert,
  cleanAnalyticsPath,
  cleanAnalyticsProperties,
  cleanAnalyticsReferrer,
} from "../../../src/lib/analytics-payload.ts";
import { readBoundedJsonObject } from "../../../src/lib/request-json.ts";

test("analytics path strips search terms and fragments", () => {
  assert.equal(cleanAnalyticsPath("/cases?q=private-search#result"), "/cases");
  assert.equal(cleanAnalyticsPath("https://example.com/private"), "/");
});

test("analytics referrer keeps only a valid web origin", () => {
  assert.equal(
    cleanAnalyticsReferrer("https://example.com/private/path?token=secret"),
    "https://example.com"
  );
  assert.equal(cleanAnalyticsReferrer("javascript:alert(1)"), null);
});

test("event properties use an event-specific allowlist", () => {
  assert.deepEqual(
    cleanAnalyticsProperties("case_search", {
      hasQuery: true,
      queryLength: 999,
      filter: "video",
      query: "must not be stored",
      email: "private@example.com",
    }),
    {
      hasQuery: true,
      queryLength: 500,
      filter: "video",
    }
  );
});

test("analytics insert sanitizes path, referrer, session and properties", () => {
  assert.deepEqual(
    buildAnalyticsInsert({
      eventName: "case_open",
      path: "/cases/example?from=private",
      referrer: "https://social.example/u/carl?token=secret",
      sessionId: "not valid!",
      properties: {
        caseSlug: "example",
        contact: "must not be stored",
      },
    }),
    {
      event_name: "case_open",
      path: "/cases/example",
      referrer: "https://social.example",
      anonymous_session_id: "ephemeral",
      properties: {
        caseSlug: "example",
      },
    }
  );
});

test("analytics insert rejects unsupported events", () => {
  assert.equal(buildAnalyticsInsert({ eventName: "user_email" }), null);
});

test("bounded JSON accepts a normal object", async () => {
  const result = await readBoundedJsonObject(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    }),
    1_024
  );
  assert.deepEqual(result, {
    ok: true,
    value: { message: "hello" },
  });
});

test("bounded JSON checks actual UTF-8 bytes without content-length", async () => {
  const result = await readBoundedJsonObject(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ message: "中".repeat(20) }),
    }),
    32
  );
  assert.deepEqual(result, {
    ok: false,
    status: 413,
    error: "payload too large",
  });
});

test("bounded JSON rejects arrays and invalid JSON", async () => {
  const arrayResult = await readBoundedJsonObject(
    new Request("https://example.com", { method: "POST", body: "[]" }),
    1_024
  );
  const invalidResult = await readBoundedJsonObject(
    new Request("https://example.com", { method: "POST", body: "{" }),
    1_024
  );
  assert.equal(arrayResult.ok, false);
  assert.equal(arrayResult.status, 400);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.status, 400);
});
