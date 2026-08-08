/**
 * apply-verdict 的批量模式：解析批量输入、逐条应用、汇总成败。
 *
 * 为什么要批量
 * ------------
 * 单条模式每成功一条就戳一次 Deploy Hook，应用 N 条 = N 次全量构建。上线后
 * 大批量录入/复测时这条路直接走不通（构建排队 + 白烧额度）。批量模式把「写库」
 * 和「触发部署」拆开：库逐条写、逐条报成败，部署收尾只在**至少一条真的改到了
 * 已发布 Case** 时触发一次。
 *
 * 输入格式为什么是 --file
 * -----------------------
 * 运营手上现成的数据文件就是 scripts/retest/retest-manifest.json：run-retest 产出，
 * records[] 里 verdict / reviewerNotes / reviewer 三个字段本来就是留给人填的
 * （见 manifest 的 note 字段）。所以批量文件直接吃这个形状——人把 manifest 填完
 * 就能整份喂进来，不用再手工转成别的格式。同时也吃裸数组，方便临时拼一份。
 *
 * verdict 留空的行是**跳过**不是失败：一份刚跑完还没审的 manifest 整份 verdict
 * 都是 null，把它报成 10 条失败只会让人以为脚本坏了。
 */

/** manifest 里这些字段名是给人填的别名，映射到库里的列。 */
function pickNotes(record) {
  return record.notes ?? record.reviewerNotes ?? record.reviewer_notes ?? "";
}

function pickOperator(record) {
  return record.operator ?? record.reviewer ?? "";
}

function pickSlug(record) {
  return record.slug ?? record.case_slug ?? record.caseSlug ?? "";
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * @param raw 已经 JSON.parse 过的内容：数组，或 { records: [...] }（manifest 原样）
 * @param defaults 命令行上给的批量默认值，逐条字段缺失时兜底
 * @returns {{ entries: object[], skipped: object[] }}
 */
export function parseVerdictBatch(raw, { defaultOperator = "", defaultNotes = "" } = {}) {
  const records = Array.isArray(raw) ? raw : Array.isArray(raw?.records) ? raw.records : null;
  if (!records) {
    throw new Error("批量文件必须是 JSON 数组，或带 records 数组的对象（retest-manifest.json 原样即可）。");
  }

  const entries = [];
  const skipped = [];

  records.forEach((record, index) => {
    if (!record || typeof record !== "object") {
      entries.push({ label: `第 ${index + 1} 行`, error: "不是对象，无法解析。" });
      return;
    }

    const slug = trimmed(pickSlug(record));
    const id = record.id ?? record.retestId ?? record.retest_id ?? null;
    const label = slug || (id != null ? `id=${id}` : `第 ${index + 1} 行`);
    const verdict = trimmed(record.verdict);

    // 没判的行直接跳过：manifest 刚跑完就是这个样子，不是错误。
    if (!verdict) {
      skipped.push({ label, reason: "verdict 留空，还没人审" });
      return;
    }

    if (id == null && !slug) {
      entries.push({ label, error: "缺少 id 或 slug，定位不到 case_retests 行。" });
      return;
    }

    entries.push({
      label,
      id: id == null ? null : String(id),
      slug: slug || null,
      verdict,
      notes: trimmed(pickNotes(record)) || trimmed(defaultNotes),
      operator: trimmed(pickOperator(record)) || trimmed(defaultOperator),
    });
  });

  return { entries, skipped };
}

/**
 * 逐条应用，单条失败不打断后面的行。
 *
 * 一条失败就整批中断是最差的选择：前面已经写进去的行没法回滚，人还得自己算
 * 「哪几条已经生效了」，重跑又要 --force。所以这里吞掉单条异常，最后一起报。
 *
 * @param applyEntry 真正写库的动作，成功返回 { slug, caseUpdated, message }，失败抛错
 */
export async function applyVerdictBatch({ entries = [], applyEntry }) {
  const results = [];
  for (const entry of entries) {
    if (entry.error) {
      results.push({ entry, ok: false, error: new Error(entry.error) });
      continue;
    }
    try {
      const outcome = (await applyEntry(entry)) ?? {};
      results.push({
        entry,
        ok: true,
        slug: outcome.slug ?? entry.slug ?? entry.label,
        caseUpdated: Boolean(outcome.caseUpdated),
        message: outcome.message ?? "",
      });
    } catch (error) {
      results.push({ entry, ok: false, error });
    }
  }
  return summarizeVerdictBatch(results);
}

/**
 * updatedCaseCount 只数「真的改到了已发布 Case」的行，不是「写成功」的行数：
 * verdict 落进 case_retests 但算不出分数、或站上根本没发布这条 Case 时，公开页面
 * 一个字都没变，不该为它跑一次构建。shouldTriggerRetestDeploy 吃的就是这个数。
 */
export function summarizeVerdictBatch(results = []) {
  const succeeded = results.filter((item) => item.ok);
  const failed = results.filter((item) => !item.ok);
  const updatedSlugs = succeeded.filter((item) => item.caseUpdated).map((item) => item.slug);
  return {
    results,
    succeeded,
    failed,
    successCount: succeeded.length,
    failureCount: failed.length,
    updatedCaseCount: updatedSlugs.length,
    updatedSlugs,
  };
}

export function formatBatchReport(summary, skipped = []) {
  const lines = [];
  for (const item of summary.results) {
    if (item.ok) {
      lines.push(`  ✅ ${item.slug}${item.message ? ` —— ${item.message}` : ""}`);
    } else {
      const reason = item.error instanceof Error ? item.error.message : String(item.error);
      lines.push(`  ❌ ${item.entry.label} —— ${reason}`);
    }
  }
  for (const item of skipped) {
    lines.push(`  ⏭️  ${item.label} —— ${item.reason}`);
  }
  lines.push("");
  lines.push(
    `合计：成功 ${summary.successCount} 条，失败 ${summary.failureCount} 条，跳过 ${skipped.length} 条；` +
      `其中改到已发布 Case ${summary.updatedCaseCount} 条。`
  );
  return lines.join("\n");
}
