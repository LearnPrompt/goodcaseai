#!/usr/bin/env node

import dns from "node:dns/promises";
import {
  TARGET_HTTP_CHECKS,
  WECHAT_UA_PATHS,
  evaluateReadiness,
  isExpectedLegacyRedirect,
  parseArgs,
  stableObservation,
} from "./lib/domain-readiness.mjs";

const WECHAT_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.56";

function printableError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkDns(hostname, expectedIpv4) {
  try {
    const addresses = await dns.resolve4(hostname);
    return {
      ok: addresses.includes(expectedIpv4),
      addresses,
      expectedIpv4,
    };
  } catch (error) {
    return {
      ok: false,
      addresses: [],
      expectedIpv4,
      error: printableError(error),
    };
  }
}

async function checkHttp({
  origin,
  path,
  expectedContentType,
  timeoutMs,
  headers,
}) {
  const url = new URL(path, `${origin}/`);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers,
        redirect: "manual",
      },
      timeoutMs
    );
    const contentType = response.headers.get("content-type") || "";
    return {
      ok:
        response.status === 200 &&
        contentType.toLowerCase().includes(expectedContentType),
      url: url.toString(),
      status: response.status,
      contentType,
      response,
    };
  } catch (error) {
    return {
      ok: false,
      url: url.toString(),
      status: 0,
      contentType: "",
      error: printableError(error),
    };
  }
}

async function checkTargetHttp(options) {
  const results = [];
  let firstCaseSlug = "";

  for (const check of TARGET_HTTP_CHECKS) {
    const path = check.path.replace("#feedback", "");
    const result = await checkHttp({
      origin: options.targetOrigin,
      path,
      expectedContentType: check.contentType,
      timeoutMs: options.timeoutMs,
    });

    if (check.id === "public_api" && result.ok && result.response) {
      try {
        const body = await result.response.json();
        firstCaseSlug = body.items?.[0]?.slug || "";
      } catch (error) {
        result.ok = false;
        result.error = `invalid JSON: ${printableError(error)}`;
      }
    }

    delete result.response;
    results.push({ id: check.id, ...result });
  }

  if (firstCaseSlug) {
    const dynamicChecks = [
      {
        id: "case_detail",
        path: `/cases/${encodeURIComponent(firstCaseSlug)}`,
        contentType: "text/html",
      },
      {
        id: "case_api",
        path: `/api/public/cases/${encodeURIComponent(firstCaseSlug)}`,
        contentType: "application/json",
      },
      {
        id: "case_og",
        path: `/cases/${encodeURIComponent(firstCaseSlug)}/opengraph-image`,
        contentType: "image/",
      },
    ];

    for (const check of dynamicChecks) {
      const result = await checkHttp({
        origin: options.targetOrigin,
        path: check.path,
        expectedContentType: check.contentType,
        timeoutMs: options.timeoutMs,
      });
      delete result.response;
      results.push({ id: check.id, ...result });
    }
  } else {
    results.push(
      {
        id: "case_detail",
        ok: false,
        error: "public API returned no case slug",
      },
      {
        id: "case_api",
        ok: false,
        error: "public API returned no case slug",
      },
      {
        id: "case_og",
        ok: false,
        error: "public API returned no case slug",
      }
    );
  }

  return {
    ok: results.every((item) => item.ok),
    firstCaseSlug,
    results,
  };
}

async function checkWechatUa(options) {
  const results = [];

  for (const path of WECHAT_UA_PATHS) {
    const result = await checkHttp({
      origin: options.targetOrigin,
      path,
      expectedContentType: "text/html",
      timeoutMs: options.timeoutMs,
      headers: { "user-agent": WECHAT_USER_AGENT },
    });
    delete result.response;
    results.push({ path, ...result });
  }

  return {
    ok: results.every((item) => item.ok),
    results,
    note: "HTTP UA smoke only; it does not replace a real WeChat WebView/share test.",
  };
}

async function checkLegacyRedirect(options, slug) {
  if (options.phase !== "post-301") {
    return {
      ok: false,
      skipped: true,
      note: "Run with --phase=post-301 after enabling the redirect.",
    };
  }

  const path = `/cases/${encodeURIComponent(
    slug || "real-case-01-umesh-ai"
  )}?from=legacy-check`;
  const legacyUrl = new URL(path, `${options.legacyOrigin}/`).toString();

  try {
    const response = await fetchWithTimeout(
      legacyUrl,
      { redirect: "manual" },
      options.timeoutMs
    );
    const location = response.headers.get("location") || "";
    return {
      ok:
        response.status === 301 &&
        isExpectedLegacyRedirect({
          legacyUrl,
          location,
          targetOrigin: options.targetOrigin,
        }),
      status: response.status,
      legacyUrl,
      location,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      legacyUrl,
      location: "",
      error: printableError(error),
    };
  }
}

function line(ok, label, detail = "") {
  const marker = ok ? "PASS" : "BLOCK";
  return `${marker.padEnd(5)} ${label}${detail ? ` — ${detail}` : ""}`;
}

function printHuman(report) {
  console.log("GoodCase domain readiness");
  console.log(`Target: ${report.options.targetOrigin}`);
  console.log(
    line(
      report.dns.ok,
      "DNS",
      report.dns.addresses.length
        ? report.dns.addresses.join(", ")
        : report.dns.error || "no A record"
    )
  );

  for (const item of report.targetHttp.results) {
    console.log(
      line(
        item.ok,
        `HTTP ${item.id}`,
        item.status
          ? `${item.status} ${item.contentType}`
          : item.error || "not checked"
      )
    );
  }

  console.log(
    line(
      report.wechatUa.ok,
      "WeChat UA HTTP",
      "server compatibility only"
    )
  );
  console.log(
    line(report.options.filingApproved, "Filing", "manual evidence gate")
  );
  console.log(
    line(
      report.options.wechatRealDevicePassed,
      "WeChat real device",
      "open/share/video/forms"
    )
  );
  console.log(
    line(
      report.stability.ok,
      "Stable observation",
      report.stability.reason
    )
  );

  if (report.options.phase === "post-301") {
    console.log(
      line(
        report.legacyRedirect.ok,
        "Legacy 301",
        report.legacyRedirect.status
          ? `${report.legacyRedirect.status} ${report.legacyRedirect.location}`
          : report.legacyRedirect.error || "not verified"
      )
    );
  }

  console.log(
    report.decision.ready
      ? "READY: migration gates passed."
      : `NOT READY: ${report.decision.blockers.join(", ")}`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const hostname = new URL(options.targetOrigin).hostname;

  const [dnsResult, targetHttp, wechatUa] = await Promise.all([
    checkDns(hostname, options.expectedIpv4),
    checkTargetHttp(options),
    checkWechatUa(options),
  ]);
  const stability = stableObservation(
    options.stableSince,
    Date.now(),
    options.requiredStableHours
  );
  const legacyRedirect = await checkLegacyRedirect(
    options,
    targetHttp.firstCaseSlug
  );
  const decision = evaluateReadiness({
    dnsOk: dnsResult.ok,
    targetHttpOk: targetHttp.ok,
    wechatUaHttpOk: wechatUa.ok,
    filingApproved: options.filingApproved,
    wechatRealDevicePassed: options.wechatRealDevicePassed,
    stableObservationOk: stability.ok,
    phase: options.phase,
    legacyRedirectOk: legacyRedirect.ok,
  });
  const report = {
    checkedAt: new Date().toISOString(),
    options,
    dns: dnsResult,
    targetHttp,
    wechatUa,
    stability,
    legacyRedirect,
    decision,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  process.exitCode = decision.ready ? 0 : 2;
}

main().catch((error) => {
  console.error(printableError(error));
  process.exitCode = 1;
});
