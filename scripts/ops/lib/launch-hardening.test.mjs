import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeCreatorIdentity,
  slugifyCreatorName,
} from "../../../src/lib/creator-slug.ts";

const [nextConfig, proxy, sitemap, sitemapData] = await Promise.all([
  readFile(new URL("../../../next.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../src/proxy.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../src/app/sitemap.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../src/lib/sitemap-data.ts", import.meta.url), "utf8"),
]);

test("public routes include the launch security headers", () => {
  for (const header of [
    "Content-Security-Policy",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    assert.match(nextConfig, new RegExp(`key: "${header}"`));
  }
});

test("www requests permanently redirect without losing path or query", () => {
  assert.match(proxy, /const WWW_HOST = "www\.goodcase\.ai"/);
  assert.match(proxy, /requestHost === WWW_HOST/);
  assert.match(
    proxy,
    /`\$\{request\.nextUrl\.pathname\}\$\{request\.nextUrl\.search\}`/
  );
  assert.match(proxy, /NextResponse\.redirect\(destination, 301\)/);
});

test("sitemap reads current case data at request time", () => {
  assert.match(sitemap, /export const dynamic = "force-dynamic"/);
  assert.match(sitemap, /getSitemapData/);
  assert.match(
    sitemapData,
    /"slug,title,category,creator_name,tags"/
  );
  assert.match(sitemapData, /deriveSkillCatalog/);
  assert.match(sitemapData, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("creator slugs preserve non-Latin identities without collisions", () => {
  assert.equal(
    normalizeCreatorIdentity("@LudovicCreator"),
    normalizeCreatorIdentity("LudovicCreator")
  );
  assert.equal(slugifyCreatorName("𝐌"), "m");
  assert.notEqual(slugifyCreatorName("アシタ🩵"), "");
  assert.notEqual(
    slugifyCreatorName("AIライフハック"),
    slugifyCreatorName("のぞむ＊AIイラスト")
  );
});
