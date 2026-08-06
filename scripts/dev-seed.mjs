#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  assertDifferentHosts,
  fetchPublishedCases,
  normalizeOrigin,
  toLocalCaseRow,
  upsertCases,
} from "./ops/lib/dev-seed.mjs";

const dryRun = process.argv.includes("--dry-run");
const unexpectedArgs = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
if (unexpectedArgs.length > 0) {
  console.error("Usage: npm run dev:seed [-- --dry-run]");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

function createSupabase(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const sourceUrl = requireEnv("PROD_SUPABASE_URL");
  const sourceAnonKey = requireEnv("PROD_SUPABASE_ANON_KEY");
  const targetUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const targetServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertDifferentHosts(sourceUrl, targetUrl);

  const sourceClient = createSupabase(sourceUrl, sourceAnonKey);
  const rows = (await fetchPublishedCases(sourceClient)).map(toLocalCaseRow);
  if (!dryRun) {
    await upsertCases(createSupabase(targetUrl, targetServiceRoleKey), rows);
  }

  console.log(
    JSON.stringify({
      mode: dryRun ? "dry-run" : "write",
      source: normalizeOrigin(sourceUrl),
      target: normalizeOrigin(targetUrl),
      table: "cases",
      imported: rows.length,
    }),
  );
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  if (process.env.DEBUG_SEED === "1") console.error(error.stack);
  process.exitCode = 1;
});

