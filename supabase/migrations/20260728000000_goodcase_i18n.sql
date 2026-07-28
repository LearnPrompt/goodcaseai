begin;

alter table public.cases
  add column if not exists content_locale text not null default 'zh-CN',
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'untranslated';

alter table public.case_candidates
  add column if not exists content_locale text not null default 'zh-CN',
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'untranslated';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cases_content_locale_check'
  ) then
    alter table public.cases
      add constraint cases_content_locale_check
      check (content_locale in ('zh-CN', 'en'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'case_candidates_content_locale_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_content_locale_check
      check (content_locale in ('zh-CN', 'en'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cases_translation_status_check'
  ) then
    alter table public.cases
      add constraint cases_translation_status_check
      check (translation_status in ('untranslated', 'machine_draft', 'confirmed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'case_candidates_translation_status_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_translation_status_check
      check (translation_status in ('untranslated', 'machine_draft', 'confirmed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cases_translations_object_check'
  ) then
    alter table public.cases
      add constraint cases_translations_object_check
      check (jsonb_typeof(translations) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'case_candidates_translations_object_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_translations_object_check
      check (jsonb_typeof(translations) = 'object');
  end if;
end
$$;

commit;
