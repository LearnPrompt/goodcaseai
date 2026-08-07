#!/usr/bin/env node

import { Client } from "pg";
import {
  SCHEMA_MIGRATIONS_SQL,
  assertNoChecksumDrift,
  buildBaselineRows,
  hasBalancedExplicitTransaction,
  hasExplicitTransactionControl,
  missingRollbacks,
  readMigrationFiles,
  readRollbackSql,
  selectRollbackTarget,
} from "./lib/migration-runner.mjs";

const argv = process.argv.slice(2);
const args = new Set(argv);
const modes = ["--baseline", "--apply", "--rollback"];
const selectedModes = modes.filter((mode) => args.has(mode));
const rollbackFile = argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
const confirmed = args.has("--yes");
const known = (arg) => modes.includes(arg) || arg === "--yes" || arg.startsWith("--file=");

if (selectedModes.length > 1 || argv.some((arg) => !known(arg))) {
  console.error(
    "Usage: npm run ops:migrate [-- --baseline|--apply|--rollback --file=<migration> --yes]",
  );
  process.exit(1);
}

if (selectedModes[0] !== "--rollback" && (rollbackFile || confirmed)) {
  console.error("--file= and --yes are only valid with --rollback");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

async function ensureTrackingTable(client) {
  await client.query(SCHEMA_MIGRATIONS_SQL);
}

async function readApplied(client) {
  const result = await client.query(
    "select version, filename, checksum, applied_at from public.schema_migrations order by version",
  );
  return result.rows;
}

async function connect() {
  const connectionString = requireEnv("DATABASE_URL");
  const client = new Client({
    connectionString,
    // Supabase requires an encrypted database connection. The dashboard URI
    // supplies the host/password; this keeps the CLI usable with its copied URI.
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function status(client, migrations, { createTable = false } = {}) {
  if (createTable) await ensureTrackingTable(client);
  let applied;
  try {
    applied = await readApplied(client);
  } catch (error) {
    if (error.code === "42P01") {
      throw new Error("schema_migrations is missing; run npm run ops:migrate -- --baseline after schema.sql");
    }
    throw error;
  }
  assertNoChecksumDrift(migrations, applied);
  const appliedByFilename = new Map(applied.map((row) => [row.filename, row]));
  const pending = migrations.filter((migration) => !appliedByFilename.has(migration.filename));
  return { applied, pending, missingRollbackFiles: missingRollbacks(migrations) };
}

async function writeBaseline(client, migrations) {
  await client.query("begin");
  try {
    await ensureTrackingTable(client);
    const applied = await readApplied(client);
    assertNoChecksumDrift(migrations, applied);
    const existing = new Set(applied.map((row) => row.filename));
    for (const row of buildBaselineRows(migrations)) {
      if (existing.has(row.filename)) continue;
      await client.query(
        `insert into public.schema_migrations (version, filename, checksum)
         values ($1, $2, $3)`,
        [row.version, row.filename, row.checksum],
      );
    }
    await client.query("commit");
    return migrations.length - existing.size;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function applyMigration(client, migration) {
  if (!hasBalancedExplicitTransaction(migration.sql)) {
    throw new Error(`Migration has unbalanced transaction statements: ${migration.filename}`);
  }
  const explicitTransaction = hasExplicitTransactionControl(migration.sql);
  if (!explicitTransaction) await client.query("begin");
  try {
    await client.query(migration.sql);
    if (!explicitTransaction) await client.query("commit");
  } catch (error) {
    if (!explicitTransaction) await client.query("rollback");
    throw error;
  }
  // Record after the migration commit. If this insert fails, the migration is
  // intentionally safe to rerun because project migrations are idempotent.
  await client.query(
    `insert into public.schema_migrations (version, filename, checksum)
     values ($1, $2, $3)`,
    [migration.version, migration.filename, migration.checksum],
  );
}

async function rollbackMigration(client, migration) {
  const sql = await readRollbackSql(migration);
  if (!hasBalancedExplicitTransaction(sql)) {
    throw new Error(`Rollback has unbalanced transaction statements: ${migration.rollbackFilename}`);
  }
  const explicitTransaction = hasExplicitTransactionControl(sql);
  if (!explicitTransaction) await client.query("begin");
  try {
    await client.query(sql);
    if (!explicitTransaction) await client.query("commit");
  } catch (error) {
    if (!explicitTransaction) await client.query("rollback");
    throw error;
  }
  // 记录删在回滚提交之后，与 applyMigration 的顺序对称。这一步失败时结构已经没了、
  // 记录还在，重跑一次即可——回滚脚本是 drop ... if exists 的幂等写法。
  // 反过来先删记录的话，中途失败会留下「结构还在但记录没了」，下次 --apply 会重跑迁移。
  await client.query("delete from public.schema_migrations where filename = $1", [
    migration.filename,
  ]);
}

async function main() {
  const migrations = await readMigrationFiles();
  const rollbackFiles = missingRollbacks(migrations);
  if (rollbackFiles.length > 0) {
    throw new Error(`Missing rollback files:\n${rollbackFiles.map((file) => `- ${file}`).join("\n")}`);
  }

  const client = await connect();
  try {
    const mode = selectedModes[0] ?? "--status";
    if (mode === "--baseline") {
      const inserted = await writeBaseline(client, migrations);
      console.log(JSON.stringify({ mode: "baseline", recorded: migrations.length, inserted }));
      return;
    }

    const current = await status(client, migrations, { createTable: false });
    if (mode === "--status") {
      console.log(
        JSON.stringify({
          mode: "status",
          applied: current.applied.map((row) => row.filename),
          pending: current.pending.map((migration) => migration.filename),
          missingRollbackFiles: current.missingRollbackFiles,
        }),
      );
      return;
    }

    if (mode === "--rollback") {
      const target = selectRollbackTarget(migrations, current.applied, rollbackFile);
      if (!confirmed) {
        console.error(
          `Refusing to roll back ${target.filename} without --yes.\n` +
            `Rollbacks drop objects and the data in them; read ` +
            `supabase/rollbacks/${target.rollbackFilename} first, and back up production before running it.`,
        );
        process.exitCode = 1;
        return;
      }
      console.log(`Rolling back ${target.filename} via ${target.rollbackFilename}`);
      await rollbackMigration(client, target);
      console.log(JSON.stringify({ mode: "rollback", rolledBack: target.filename }));
      return;
    }

    for (const migration of current.pending) {
      console.log(`Applying ${migration.filename}`);
      await applyMigration(client, migration);
    }
    console.log(JSON.stringify({ mode: "apply", applied: current.pending.map((migration) => migration.filename) }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  if (process.env.DEBUG_MIGRATIONS === "1") console.error(error.stack);
  process.exitCode = 1;
});
