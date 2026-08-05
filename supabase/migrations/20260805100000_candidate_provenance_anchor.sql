-- 候选溯源锚点：把 youmind `isBasedOn` 上的 fragment 独立存下来。
--
-- 背景（2026-08-05 溯源审计）：youmind 的 image 类 prompt 有相当比例是它自己拿产出图
-- 逆向重构的，不是作者原文，但 `isBasedOn` 照样指向原推。它唯一自曝的信号是 URL 末尾
-- 的 `#reversed-N` 锚点（带锚点已核对 6 条全部对不上，不带锚点 30 条全部对得上）。
-- 这个锚点以前在 scripts/supply/adapters/youmind.mjs 的 stripSourceFragment() 里被
-- 抹掉，全库 cases / case_candidates 的 source_url 含 `#reversed` 的数量都是 0。
--
-- source_url 保持去 hash 不变（展示、去重、和历史数据对齐都靠它），
-- fragment 单独落在 provenance_anchor 上，只做取证不参与去重。

alter table public.case_candidates
  add column if not exists provenance_anchor text;

comment on column public.case_candidates.provenance_anchor is
  '来源 URL 的 fragment（youmind 的 #reversed-N 等）。仅取证用，不参与 dedupe_key。';

-- 带 reversed 锚点的候选一律不许自动进 pending：代码层已经拦（scripts/ingest-candidates.mjs），
-- 这里再加一条库级约束，任何绕过脚本的直接写入也挡住。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'case_candidates_no_reversed_pending_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_no_reversed_pending_check
      check (
        status <> 'pending'
        or provenance_anchor is null
        or provenance_anchor !~* '^reversed(-[0-9]+)?$'
      );
  end if;
end
$$;

create index if not exists case_candidates_provenance_anchor_idx
  on public.case_candidates (provenance_anchor)
  where provenance_anchor is not null;
