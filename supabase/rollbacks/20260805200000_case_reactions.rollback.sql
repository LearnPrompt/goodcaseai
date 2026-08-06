begin;

drop index if exists public.case_reactions_slug_kind_idx;
drop index if exists public.case_reactions_session_kind_key;
drop table if exists public.case_reactions;

commit;

