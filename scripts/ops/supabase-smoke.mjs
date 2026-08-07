#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "../retest/lib/env.mjs";
import { assertTestTarget } from "./lib/supabase-smoke.mjs";

function getArg(name) {
  const found = process.argv.find((item) => item.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : "";
}

async function main() {
  const env = await readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const project = assertTestTarget({
    url,
    expectedProject: getArg("--expect-project") || env.SUPABASE_TEST_PROJECT_REF,
    productionUrl: env.PROD_SUPABASE_URL,
  });
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY。");

  const supabase = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = await Promise.all([
    supabase.from("schema_migrations").select("filename").order("filename", { ascending: false }).limit(1),
    supabase.from("cases").select("slug, stability_score, evidence_level", { count: "exact", head: true }),
    supabase.from("case_reactions").select("case_slug", { count: "exact", head: true }),
    supabase.from("case_retests").select("id, case_slug, verdict", { count: "exact", head: true }),
  ]);
  const labels = ["schema_migrations", "cases", "case_reactions", "case_retests"];
  for (let index = 0; index < checks.length; index += 1) {
    if (checks[index].error) {
      throw new Error(`${labels[index]} smoke 失败：${checks[index].error.message}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    project,
    latestMigration: checks[0].data?.[0]?.filename || null,
    counts: {
      cases: checks[1].count ?? null,
      caseReactions: checks[2].count ?? null,
      caseRetests: checks[3].count ?? null,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

