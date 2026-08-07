import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoChecksumDrift,
  buildBaselineRows,
  checksumSql,
  hasBalancedExplicitTransaction,
  hasExplicitTransactionControl,
  parseMigrationFilename,
  selectRollbackTarget,
} from "./migration-runner.mjs";

test("migration filenames carry a sortable timestamp version", () => {
  assert.deepEqual(parseMigrationFilename("20260806000000_add_reactions.sql"), {
    filename: "20260806000000_add_reactions.sql",
    version: "20260806000000",
  });
  assert.throws(() => parseMigrationFilename("bad.sql"), /Invalid migration filename/);
});

test("migration checksums are stable SHA-256 values", () => {
  assert.equal(
    checksumSql("select 1;"),
    "354b7196c9ba5fb4b21cf615bb6ec4cd5c07503c34229feef033fc081a8c03f4",
  );
});

test("baseline rows contain only tracking metadata", () => {
  assert.deepEqual(
    buildBaselineRows([{ version: "20260806000000", filename: "x.sql", checksum: "abc" }]),
    [{ version: "20260806000000", filename: "x.sql", checksum: "abc" }],
  );
});

test("transaction detection distinguishes self-managed migrations", () => {
  assert.equal(hasExplicitTransactionControl("begin; select 1; commit;"), true);
  assert.equal(hasBalancedExplicitTransaction("begin; select 1; commit;"), true);
  assert.equal(hasExplicitTransactionControl("alter table x add column y text;"), false);
  assert.equal(hasBalancedExplicitTransaction("begin; select 1;"), false);
});

test("applied migration checksum drift is rejected", () => {
  assert.throws(
    () =>
      assertNoChecksumDrift(
        [{ filename: "x.sql", checksum: "new" }],
        [{ filename: "x.sql", checksum: "old" }],
      ),
    /checksum changed/,
  );
});

test("rollback only targets the most recently applied migration", () => {
  const migrations = [
    { filename: "20260101000000_a.sql", version: "20260101000000", rollbackExists: true, rollbackFilename: "20260101000000_a.rollback.sql" },
    { filename: "20260202000000_b.sql", version: "20260202000000", rollbackExists: true, rollbackFilename: "20260202000000_b.rollback.sql" },
  ];
  const applied = [
    { filename: "20260101000000_a.sql", version: "20260101000000" },
    { filename: "20260202000000_b.sql", version: "20260202000000" },
  ];

  assert.equal(
    selectRollbackTarget(migrations, applied, "20260202000000_b.sql").filename,
    "20260202000000_b.sql",
  );

  // 回滚中间那个会让 b 悬空，且 schema_migrations 仍记着 b 已应用。
  assert.throws(
    () => selectRollbackTarget(migrations, applied, "20260101000000_a.sql"),
    /most recently applied/,
  );

  // b 退掉之后 a 才轮得到。
  assert.equal(
    selectRollbackTarget(migrations, [applied[0]], "20260101000000_a.sql").filename,
    "20260101000000_a.sql",
  );
});

test("rollback refuses unknown, unapplied, and unspecified targets", () => {
  const migrations = [
    { filename: "20260101000000_a.sql", version: "20260101000000", rollbackExists: true, rollbackFilename: "20260101000000_a.rollback.sql" },
    { filename: "20260202000000_b.sql", version: "20260202000000", rollbackExists: true, rollbackFilename: "20260202000000_b.rollback.sql" },
  ];
  const applied = [{ filename: "20260101000000_a.sql", version: "20260101000000" }];

  assert.throws(() => selectRollbackTarget(migrations, applied, ""), /explicit target/);
  assert.throws(() => selectRollbackTarget(migrations, applied, "nope.sql"), /Unknown migration file/);
  assert.throws(
    () => selectRollbackTarget(migrations, applied, "20260202000000_b.sql"),
    /not applied/,
  );
  assert.throws(
    () =>
      selectRollbackTarget(
        [{ filename: "20260101000000_a.sql", version: "20260101000000", rollbackExists: false, rollbackFilename: "20260101000000_a.rollback.sql" }],
        applied,
        "20260101000000_a.sql",
      ),
    /Missing rollback file/,
  );
});
