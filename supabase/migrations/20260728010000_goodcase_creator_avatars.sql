begin;

alter table public.cases
  add column if not exists creator_avatar_url text;

alter table public.case_candidates
  add column if not exists creator_avatar_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_creator_avatar_url_check'
  ) then
    alter table public.cases
      add constraint cases_creator_avatar_url_check
      check (
        creator_avatar_url is null
        or creator_avatar_url ~ '^https://'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_candidates_creator_avatar_url_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_creator_avatar_url_check
      check (
        creator_avatar_url is null
        or creator_avatar_url ~ '^https://'
      );
  end if;
end
$$;

comment on column public.cases.creator_avatar_url is
  'Public creator avatar verified from the original source profile.';

comment on column public.case_candidates.creator_avatar_url is
  'Public creator avatar verified from the original source profile.';

commit;
