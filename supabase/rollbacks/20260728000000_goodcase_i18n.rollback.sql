begin;

alter table public.cases
  drop constraint if exists cases_content_locale_check,
  drop constraint if exists cases_translation_status_check,
  drop constraint if exists cases_translations_object_check,
  drop column if exists content_locale,
  drop column if exists translations,
  drop column if exists translation_status;

alter table public.case_candidates
  drop constraint if exists case_candidates_content_locale_check,
  drop constraint if exists case_candidates_translation_status_check,
  drop constraint if exists case_candidates_translations_object_check,
  drop column if exists content_locale,
  drop column if exists translations,
  drop column if exists translation_status;

commit;
