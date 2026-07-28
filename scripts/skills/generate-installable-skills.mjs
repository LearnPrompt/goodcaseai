import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { deriveSkillCatalog } from "../../src/lib/skills.ts";
import {
  assertValidSkillName,
  buildInstallableSkillFiles,
} from "./lib/render-installable-skill.mjs";

const PAGE_SIZE = 1_000;
const root = process.cwd();
const generatedRoot = path.join(root, "skills", "generated");
const packageRoot = path.join(root, "public", "skill-packages");
const manifestPath = path.join(
  root,
  "src",
  "generated",
  "installable-skills.json"
);
const skillCreatorRoot = process.env.SKILL_CREATOR_ROOT;

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchPublishedCases() {
  const baseUrl = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const rows = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URL("/rest/v1/cases", baseUrl);
    query.searchParams.set(
      "select",
      "slug,title,category,creator_name,tags,source_url"
    );
    query.searchParams.set("is_published", "eq.true");
    query.searchParams.set("order", "slug.asc");
    query.searchParams.set("limit", String(PAGE_SIZE));
    query.searchParams.set("offset", String(offset));

    const response = await fetch(query, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Accept-Profile": "public",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load published Cases: ${response.status} ${await response.text()}`
      );
    }

    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.flatMap((row) => {
    if (
      row.category !== "image" &&
      row.category !== "video" &&
      row.category !== "web" &&
      row.category !== "copy" &&
      row.category !== "hardware"
    ) {
      return [];
    }
    return [
      {
        slug: row.slug,
        title: row.title,
        category: row.category,
        creator: row.creator_name || "Anonymous creator",
        tags: row.tags || [],
        sourceUrl: row.source_url || "",
      },
    ];
  });
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    );
  }
  return result.stdout.trim();
}

function initializeSkill(skillName) {
  if (!skillCreatorRoot) {
    throw new Error(
      `SKILL_CREATOR_ROOT is required to initialize new Skill ${skillName}`
    );
  }
  run("python3", [
    path.join(skillCreatorRoot, "scripts", "init_skill.py"),
    skillName,
    "--path",
    generatedRoot,
  ]);

  const skillDir = path.join(generatedRoot, skillName);
  rmSync(path.join(skillDir, "scripts"), { recursive: true, force: true });
  rmSync(path.join(skillDir, "assets"), { recursive: true, force: true });
  rmSync(path.join(skillDir, "references", "api_reference.md"), {
    force: true,
  });
}

function packageSkill(skillName) {
  if (!skillCreatorRoot) {
    throw new Error("SKILL_CREATOR_ROOT is required to validate and package Skills");
  }
  run("python3", [
    path.join(skillCreatorRoot, "scripts", "package_skill.py"),
    path.join(generatedRoot, skillName),
    packageRoot,
  ]);
}

const cases = await fetchPublishedCases();
const catalog = deriveSkillCatalog(cases, "en");

mkdirSync(generatedRoot, { recursive: true });
mkdirSync(packageRoot, { recursive: true });
mkdirSync(path.dirname(manifestPath), { recursive: true });

const definitionTitles = new Map(
  catalog.sharedSkills.map((skill) => [skill.baseSlug, skill.title])
);
const manifest = [];

for (const skill of catalog.allSkills) {
  assertValidSkillName(skill.slug);
  const skillDir = path.join(generatedRoot, skill.slug);
  if (!existsSync(skillDir)) {
    initializeSkill(skill.slug);
  }

  const files = buildInstallableSkillFiles({
    ...skill,
    baseTitle: definitionTitles.get(skill.baseSlug) || skill.title,
  });
  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === "description") {
      continue;
    }
    const outputPath = path.join(skillDir, relativePath);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  packageSkill(skill.slug);
  manifest.push({
    slug: skill.slug,
    kind: skill.kind,
    category: skill.category,
    caseCount: skill.caseCount,
    creatorCount: skill.creatorCount,
  });
}

manifest.sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  `Generated and packaged ${manifest.length} installable Skills from ${cases.length} published Cases.`
);
