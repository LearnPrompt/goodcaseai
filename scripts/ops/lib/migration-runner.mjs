import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../..",
  "supabase/migrations",
);
export const ROLLBACKS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../..",
  "supabase/rollbacks",
);

export const SCHEMA_MIGRATIONS_SQL = `
create table if not exists public.schema_migrations (
  version text primary key,
  filename text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon;
revoke all on public.schema_migrations from authenticated;
`;

const MIGRATION_NAME = /^(\d{14})_[a-z0-9][a-z0-9_-]*\.sql$/;
const TRANSACTION_STATEMENT = /(?:^|[;\n])\s*(begin|commit|rollback)\s*;/i;
const TRANSACTION_STATEMENTS = /(?:^|[;\n])\s*(begin|commit|rollback)\s*;/gi;

export function checksumSql(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export function hasExplicitTransactionControl(sql) {
  return TRANSACTION_STATEMENT.test(sql);
}

export function hasBalancedExplicitTransaction(sql) {
  const statements = [...sql.matchAll(TRANSACTION_STATEMENTS)].map((match) =>
    match[1].toLowerCase(),
  );
  const begins = statements.filter((statement) => statement === "begin").length;
  const commits = statements.filter((statement) => statement === "commit").length;
  const rollbacks = statements.filter((statement) => statement === "rollback").length;
  return begins === commits + rollbacks;
}

export function parseMigrationFilename(filename) {
  const match = filename.match(MIGRATION_NAME);
  if (!match) {
    throw new Error(
      `Invalid migration filename: ${filename}. Expected YYYYMMDDHHMMSS_description.sql`,
    );
  }
  return { filename, version: match[1] };
}

export async function readMigrationFiles({
  migrationsDir = MIGRATIONS_DIR,
  rollbacksDir = ROLLBACKS_DIR,
} = {}) {
  const names = (await readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const migrations = [];
  for (const filename of names) {
    const { version } = parseMigrationFilename(filename);
    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    const rollbackFilename = `${filename.slice(0, -4)}.rollback.sql`;
    let rollbackExists = true;
    try {
      await readFile(path.join(rollbacksDir, rollbackFilename), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      rollbackExists = false;
    }
    migrations.push({
      filename,
      version,
      sql,
      checksum: checksumSql(sql),
      rollbackFilename,
      rollbackExists,
    });
  }
  return migrations;
}

export function assertNoChecksumDrift(migrations, appliedRows) {
  const byFilename = new Map(migrations.map((migration) => [migration.filename, migration]));
  const drift = appliedRows
    .map((row) => {
      const migration = byFilename.get(row.filename);
      if (!migration || migration.checksum === row.checksum) return null;
      return {
        filename: row.filename,
        recorded: row.checksum,
        current: migration.checksum,
      };
    })
    .filter(Boolean);
  if (drift.length > 0) {
    throw new Error(
      `Applied migration checksum changed; create a new migration instead:\n${drift
        .map((item) => `- ${item.filename}`)
        .join("\n")}`,
    );
  }
  return drift;
}

export function missingRollbacks(migrations) {
  return migrations.filter((migration) => !migration.rollbackExists).map((migration) => migration.filename);
}

export function buildBaselineRows(migrations) {
  return migrations.map(({ version, filename, checksum }) => ({
    version,
    filename,
    checksum,
  }));
}

export function connectionLabel(connectionString) {
  const url = new URL(connectionString);
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}/${url.pathname.replace(/^\//, "")}`;
}
