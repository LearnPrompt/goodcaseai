import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const OPERATOR_SESSION_COOKIE = "goodcase-operator-session";
export const OPERATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const SESSION_VERSION = "v1";

function safeHashEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isSharedOperatorConfigured(
  password: string | undefined,
  sessionSecret: string | undefined
) {
  return Boolean(
    password &&
      password.length >= 12 &&
      sessionSecret &&
      sessionSecret.length >= 32
  );
}

export function verifySharedOperatorPassword(
  input: string,
  configuredPassword: string
) {
  return safeHashEqual(input, configuredPassword);
}

function signature(payload: string, sessionSecret: string) {
  return createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
}

export function createSharedOperatorSession(
  sessionSecret: string,
  nowMs = Date.now()
) {
  const expiresAt =
    Math.floor(nowMs / 1000) + OPERATOR_SESSION_MAX_AGE_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${signature(payload, sessionSecret)}`;
}

export function verifySharedOperatorSession(
  token: string | undefined,
  sessionSecret: string,
  nowMs = Date.now()
) {
  if (!token) return false;

  const [version, rawExpiresAt, suppliedSignature, extra] = token.split(".");
  if (
    version !== SESSION_VERSION ||
    extra !== undefined ||
    !/^\d+$/.test(rawExpiresAt || "") ||
    !suppliedSignature
  ) {
    return false;
  }

  const expiresAt = Number(rawExpiresAt);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= nowSeconds ||
    expiresAt > nowSeconds + OPERATOR_SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const payload = `${version}.${rawExpiresAt}`;
  return safeHashEqual(
    suppliedSignature,
    signature(payload, sessionSecret)
  );
}

export function normalizeOperatorNextPath(value: unknown) {
  if (typeof value !== "string") return "/operator";
  const trimmed = value.trim();
  return trimmed === "/operator" ||
    trimmed.startsWith("/operator?") ||
    trimmed === "/en/operator" ||
    trimmed.startsWith("/en/operator?")
    ? trimmed
    : "/operator";
}
