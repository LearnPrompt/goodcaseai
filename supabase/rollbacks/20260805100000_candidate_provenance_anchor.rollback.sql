begin;

drop index if exists public.case_candidates_provenance_anchor_idx;
alter table public.case_candidates
  drop constraint if exists case_candidates_no_reversed_pending_check,
  drop column if exists provenance_anchor;

commit;

