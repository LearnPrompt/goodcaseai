import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_CHARS = 20_000;
const OUTPUT_DIR = path.join("tmp", "translation-backfill");
const CJK_PATTERN = /[\u3400-\u9fff]/;

function parseArgs(argv) {
  const options = {
    mode: "",
    applyPath: "",
    provider: "codex",
    model: "",
    limit: 0,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of argv) {
    if (arg === "--generate") {
      options.mode = "generate";
    } else if (arg.startsWith("--apply=")) {
      options.mode = "apply";
      options.applyPath = arg.slice("--apply=".length);
    } else if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length).trim();
    } else if (arg.startsWith("--provider=")) {
      options.provider = arg.slice("--provider=".length).trim();
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = Number.parseInt(
        arg.slice("--batch-size=".length),
        10
      );
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["generate", "apply"].includes(options.mode)) {
    throw new Error("Use --generate or --apply=PATH");
  }
  if (!["codex", "claude", "openrouter"].includes(options.provider)) {
    throw new Error("--provider must be codex, claude or openrouter");
  }
  if (!options.model && options.provider === "claude") {
    options.model = "sonnet";
  } else if (!options.model && options.provider === "openrouter") {
    options.model = "openai/gpt-4.1-mini";
  }
  if (!Number.isInteger(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative integer");
  }
  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize < 1 ||
    options.batchSize > 100
  ) {
    throw new Error("--batch-size must be between 1 and 100");
  }

  return options;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function sourceHash(row) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        promptFull: row.prompt_full,
      })
    )
    .digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function hasCjk(value) {
  return CJK_PATTERN.test(value || "");
}

function splitBatches(rows, batchSize) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const row of rows) {
    const translationChars = [row.title, row.summary, row.prompt_full]
      .filter(hasCjk)
      .reduce((total, value) => total + value.length, 0);

    if (
      current.length > 0 &&
      (current.length >= batchSize ||
        currentChars + translationChars > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(row);
    currentChars += translationChars;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, options, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status}: ${body.slice(0, 600)}`);
      }
      return body ? JSON.parse(body) : null;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(1_000 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
}

async function fetchPublishedCases() {
  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const query = new URL("/rest/v1/cases", baseUrl);
  query.searchParams.set(
    "select",
    "id,slug,title,summary,prompt_full,translations,translation_status,is_published"
  );
  query.searchParams.set("is_published", "eq.true");
  query.searchParams.set("order", "slug.asc");
  query.searchParams.set("limit", "1000");

  const rows = await fetchJson(query, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Accept-Profile": "public",
    },
  });

  if (!Array.isArray(rows)) {
    throw new Error("Supabase returned an invalid cases payload");
  }
  return rows;
}

function translationSchema() {
  return {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            promptFull: { type: "string" },
          },
          required: ["slug", "title", "summary", "promptFull"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  };
}

function translationInstructions() {
  return [
    "You translate public AI case-library content from Simplified Chinese into natural, concise English.",
    "Translate every non-null field completely without summarizing or omitting steps.",
    "For null fields, return an empty string.",
    "Preserve paragraph breaks, numbering, placeholders, template variables, URLs, @handles, model names, code, and markdown structure.",
    "Do not add commentary, claims, or facts.",
    "Return exactly one item for each input slug, in the same order.",
  ].join(" ");
}

function translationInput(rows) {
  return JSON.stringify({
    cases: rows.map((row) => ({
      slug: row.slug,
      title: hasCjk(row.title) ? row.title : null,
      summary: hasCjk(row.summary) ? row.summary : null,
      promptFull: hasCjk(row.prompt_full) ? row.prompt_full : null,
    })),
  });
}

async function runClaude(prompt, schema, model) {
  const args = [
    "-p",
    "--safe-mode",
    "--model",
    model,
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "",
    "--system-prompt",
    translationInstructions(),
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    prompt,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude translation timed out"));
    }, 180_000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(
            `Claude exited ${code}: ${Buffer.concat(stderr).toString("utf8").slice(0, 600)}`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")));
      } catch (error) {
        reject(new Error(`Claude returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function runCodex(prompt, schema, model) {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "goodcase-translation-")
  );
  const schemaPath = path.join(temporaryDirectory, "schema.json");
  const outputPath = path.join(temporaryDirectory, "output.json");
  await writeFile(schemaPath, `${JSON.stringify(schema)}\n`);

  const args = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "-C",
    temporaryDirectory,
    "-c",
    'model_reasoning_effort="low"',
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "--color",
    "never",
  ];
  if (model) {
    args.push("--model", model);
  }
  args.push("-");

  try {
    await new Promise((resolve, reject) => {
      const child = spawn("codex", args, {
        cwd: temporaryDirectory,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stderr = [];
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Codex translation timed out"));
      }, 180_000);

      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(
            new Error(
              `Codex exited ${code}: ${Buffer.concat(stderr).toString("utf8").slice(0, 600)}`
            )
          );
          return;
        }
        resolve();
      });
      child.stdin.end(prompt);
    });
    return JSON.parse(await readFile(outputPath, "utf8"));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function translateBatchWithCodex(rows, model) {
  const parsed = await runCodex(
    `${translationInstructions()}\n\nInput JSON:\n${translationInput(rows)}`,
    translationSchema(),
    model
  );
  if (!Array.isArray(parsed?.translations)) {
    throw new Error("Codex returned an invalid translation list");
  }
  if (parsed.translations.length !== rows.length) {
    throw new Error(
      `Translation count mismatch: ${parsed.translations.length}/${rows.length}`
    );
  }

  return {
    translations: parsed.translations,
    usage: null,
  };
}

async function translateBatchWithClaude(rows, model) {
  const response = await runClaude(
    translationInput(rows),
    translationSchema(),
    model
  );
  const parsed =
    response.structured_output ||
    (typeof response.result === "string" ? JSON.parse(response.result) : null);
  if (!Array.isArray(parsed?.translations)) {
    throw new Error("Claude returned an invalid translation list");
  }
  if (parsed.translations.length !== rows.length) {
    throw new Error(
      `Translation count mismatch: ${parsed.translations.length}/${rows.length}`
    );
  }

  return {
    translations: parsed.translations,
    usage: {
      totalCostUsd: response.total_cost_usd ?? null,
      usage: response.usage ?? null,
      modelUsage: response.modelUsage ?? null,
    },
  };
}

async function translateBatchWithOpenRouter(rows, model) {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const payload = {
    model,
    temperature: 0,
    max_tokens: 20_000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "goodcase_case_translations",
        strict: true,
        schema: translationSchema(),
      },
    },
    messages: [
      {
        role: "system",
        content: translationInstructions(),
      },
      {
        role: "user",
        content: translationInput(rows),
      },
    ],
  };
  const response = await fetchJson(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://goodcase.ai",
      "X-Title": "GoodCase translation backfill",
    },
    body: JSON.stringify(payload),
  });
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Translation model returned no message content");
  }

  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.translations)) {
    throw new Error("Translation model returned an invalid translation list");
  }
  if (parsed.translations.length !== rows.length) {
    throw new Error(
      `Translation count mismatch: ${parsed.translations.length}/${rows.length}`
    );
  }

  return {
    translations: parsed.translations,
    usage: response.usage || null,
  };
}

async function translateBatch(rows, options) {
  if (options.provider === "codex") {
    return translateBatchWithCodex(rows, options.model);
  }
  if (options.provider === "claude") {
    return translateBatchWithClaude(rows, options.model);
  }
  return translateBatchWithOpenRouter(rows, options.model);
}

function validateAndMergeBatch(rows, translations) {
  return rows.map((row, index) => {
    const translated = translations[index];
    if (translated?.slug !== row.slug) {
      throw new Error(
        `Translation slug mismatch at ${index}: ${translated?.slug}/${row.slug}`
      );
    }

    const target = {
      title: hasCjk(row.title) ? translated.title.trim() : row.title,
      summary: hasCjk(row.summary) ? translated.summary.trim() : row.summary,
      promptFull: hasCjk(row.prompt_full)
        ? translated.promptFull.trim()
        : row.prompt_full,
    };
    if (!target.title || !target.summary || !target.promptFull) {
      throw new Error(`Empty translated field for ${row.slug}`);
    }
    if (
      hasCjk(row.prompt_full) &&
      target.promptFull.length < row.prompt_full.length * 0.35
    ) {
      throw new Error(`Likely truncated prompt translation for ${row.slug}`);
    }

    return {
      id: row.id,
      slug: row.slug,
      sourceHash: sourceHash(row),
      en: target,
    };
  });
}

async function generateDraft(options) {
  const allRows = await fetchPublishedCases();
  const rows = options.limit > 0 ? allRows.slice(0, options.limit) : allRows;
  const batches = splitBatches(rows, options.batchSize);
  const translatedRows = [];
  const usage = [];

  process.stdout.write(
    `Generating ${rows.length} translations in ${batches.length} batches with ${options.provider}/${options.model}\n`
  );

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const result = await translateBatch(batch, options);
    translatedRows.push(
      ...validateAndMergeBatch(batch, result.translations)
    );
    usage.push(result.usage);
    process.stdout.write(
      `batch ${index + 1}/${batches.length}: ${batch.length} cases\n`
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `draft-${timestamp()}.json`);
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: options.provider,
        model: options.model,
        sourceCount: allRows.length,
        rowCount: translatedRows.length,
        status: "machine_draft",
        usage,
        rows: translatedRows,
      },
      null,
      2
    )}\n`
  );
  process.stdout.write(`draft: ${outputPath}\n`);
}

async function applyDraft(options) {
  const draft = JSON.parse(await readFile(options.applyPath, "utf8"));
  if (!Array.isArray(draft.rows) || draft.rows.length === 0) {
    throw new Error("Draft has no translation rows");
  }

  const currentRows = await fetchPublishedCases();
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  for (const translated of draft.rows) {
    const current = currentById.get(translated.id);
    if (!current || current.slug !== translated.slug) {
      throw new Error(`Case identity changed: ${translated.slug}`);
    }
    if (sourceHash(current) !== translated.sourceHash) {
      throw new Error(`Case content changed after translation: ${translated.slug}`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const backupPath = path.join(OUTPUT_DIR, `backup-${timestamp()}.json`);
  await writeFile(
    backupPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        rows: currentRows.map((row) => ({
          id: row.id,
          slug: row.slug,
          translations: row.translations,
          translation_status: row.translation_status,
        })),
      },
      null,
      2
    )}\n`
  );
  process.stdout.write(`backup: ${backupPath}\n`);

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  let updated = 0;
  for (const translated of draft.rows) {
    const current = currentById.get(translated.id);
    const translations =
      current.translations &&
      typeof current.translations === "object" &&
      !Array.isArray(current.translations)
        ? current.translations
        : {};
    const query = new URL("/rest/v1/cases", baseUrl);
    query.searchParams.set("id", `eq.${translated.id}`);
    await fetchJson(query, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "Content-Profile": "public",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        translations: {
          ...translations,
          en: translated.en,
        },
        translation_status: "machine_draft",
      }),
    });
    updated += 1;
    if (updated % 25 === 0 || updated === draft.rows.length) {
      process.stdout.write(`updated ${updated}/${draft.rows.length}\n`);
    }
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.mode === "generate") {
  await generateDraft(options);
} else {
  await applyDraft(options);
}
