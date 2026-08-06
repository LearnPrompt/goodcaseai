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
} from "./lib/migration-runner.mjs";

const args = new Set(process.argv.slice(2));
const modes = ["--baseline", "--apply"];
const selectedModes = modes.filter((mode) => args.has(mode));

if (selectedModes.length > 1 || [...args].some((arg) => !modes.includes(arg))) {
  console.error("Usage: npm run ops:migrate [-- --baseline|--apply]");
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
