begin;

alter table public.case_candidates
  drop constraint if exists case_candidates_creator_avatar_url_check,
  drop column if exists creator_avatar_url;

alter table public.cases
  drop constraint if exists cases_creator_avatar_url_check,
  drop column if exists creator_avatar_url;

commit;
