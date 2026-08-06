import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoChecksumDrift,
  buildBaselineRows,
  checksumSql,
  hasBalancedExplicitTransaction,
  hasExplicitTransactionControl,
  parseMigrationFilename,
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
