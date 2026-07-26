import assert from "node:assert/strict";
import test from "node:test";
import {
  createSharedOperatorSession,
  isSharedOperatorConfigured,
  normalizeOperatorNextPath,
  verifySharedOperatorPassword,
  verifySharedOperatorSession,
} from "../../../src/lib/operator/shared-session.ts";

const password = "a-strong-team-password";
const secret = "a-session-secret-that-is-longer-than-32-characters";
const now = Date.parse("2026-07-27T00:00:00Z");

test("shared operator configuration requires a strong password and session secret", () => {
  assert.equal(isSharedOperatorConfigured(password, secret), true);
  assert.equal(isSharedOperatorConfigured("short", secret), false);
  assert.equal(isSharedOperatorConfigured(password, "short"), false);
});

test("shared operator password comparison accepts only the configured value", () => {
  assert.equal(verifySharedOperatorPassword(password, password), true);
  assert.equal(verifySharedOperatorPassword("wrong-password", password), false);
});

test("shared operator session is signed, expires, and rejects tampering", () => {
  const token = createSharedOperatorSession(secret, now);
  assert.equal(verifySharedOperatorSession(token, secret, now), true);
  assert.equal(
    verifySharedOperatorSession(`${token}tampered`, secret, now),
    false
  );
  assert.equal(
    verifySharedOperatorSession(token, secret, now + 8 * 24 * 60 * 60 * 1000),
    false
  );
});

test("operator next path only allows internal operator destinations", () => {
  assert.equal(
    normalizeOperatorNextPath(
      "/operator?candidate=352a07c3-f72d-4d4d-bbc6-bb70f18f0441"
    ),
    "/operator?candidate=352a07c3-f72d-4d4d-bbc6-bb70f18f0441"
  );
  assert.equal(normalizeOperatorNextPath("https://evil.example"), "/operator");
  assert.equal(normalizeOperatorNextPath("/cases"), "/operator");
});
