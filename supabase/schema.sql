create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  source_platform text,
  source_url text,
  source_like_count int,
  source_comment_count int,
  source_share_count int,
  source_save_count int,
  source_published_at timestamptz,
  source_metrics_captured_at timestamptz,
  creator_name text,
  creator_avatar_url text,
  summary text not null,
  prompt_preview text,
  prompt_full text,
  content_locale text not null default 'zh-CN',
  translations jsonb not null default '{}'::jsonb,
  translation_status text not null default 'untranslated',
  media_kind text not null,
  media_url text not null,
  poster_url text,
  remake_count int not null default 0,
  stability_score int not null default 0,
  favorite_score int not null default 0,
  recommended_models text[] not null default '{}'::text[],
  cost_band text not null default 'medium',
  evidence_level text not null default 'L0',
  tags text[] not null default '{}'::text[],
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cases
  add column if not exists prompt_full text,
  add column if not exists content_locale text not null default 'zh-CN',
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'untranslated',
  add column if not exists remake_count int not null default 0,
  add column if not exists recommended_models text[] not null default '{}'::text[],
  add column if not exists cost_band text not null default 'medium',
  add column if not exists source_url text,
  add column if not exists source_like_count int,
  add column if not exists source_comment_count int,
  add column if not exists source_share_count int,
  add column if not exists source_save_count int,
  add column if not exists source_published_at timestamptz,
  add column if not exists source_metrics_captured_at timestamptz,
  add column if not exists creator_avatar_url text,
  add column if not exists evidence_level text not null default 'L0',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_published boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_cost_band_check'
  ) then
    alter table public.cases
      add constraint cases_cost_band_check
      check (cost_band in ('low', 'medium', 'high'));
  end if;
end
$$;

create table if not exists public.case_candidates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  category text not null,
  source_platform text,
  source_url text,
  source_like_count int,
  source_comment_count int,
  source_share_count int,
  source_save_count int,
  source_published_at timestamptz,
  source_metrics_captured_at timestamptz,
  creator_name text,
  creator_avatar_url text,
  summary text not null,
  prompt_preview text,
  prompt_full text,
  content_locale text not null default 'zh-CN',
  translations jsonb not null default '{}'::jsonb,
  translation_status text not null default 'untranslated',
  media_kind text not null,
  media_url text not null,
  poster_url text,
  remake_count int not null default 0,
  stability_score int not null default 0,
  favorite_score int not null default 0,
  recommended_models text[] not null default '{}'::text[],
  cost_band text not null default 'medium',
  evidence_level text not null default 'L0',
  tags text[] not null default '{}'::text[],
  status text not null default 'pending',
  dedupe_key text not null,
  import_batch_id text,
  review_note text,
  published_case_id uuid references public.cases(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_candidates
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists source_platform text,
  add column if not exists source_url text,
  add column if not exists source_like_count int,
  add column if not exists source_comment_count int,
  add column if not exists source_share_count int,
  add column if not exists source_save_count int,
  add column if not exists source_published_at timestamptz,
  add column if not exists source_metrics_captured_at timestamptz,
  add column if not exists creator_name text,
  add column if not exists creator_avatar_url text,
  add column if not exists summary text,
  add column if not exists prompt_preview text,
  add column if not exists prompt_full text,
  add column if not exists content_locale text not null default 'zh-CN',
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'untranslated',
  add column if not exists media_kind text,
  add column if not exists media_url text,
  add column if not exists poster_url text,
  add column if not exists remake_count int not null default 0,
  add column if not exists stability_score int not null default 0,
  add column if not exists favorite_score int not null default 0,
  add column if not exists recommended_models text[] not null default '{}'::text[],
  add column if not exists cost_band text not null default 'medium',
  add column if not exists evidence_level text not null default 'L0',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists status text not null default 'pending',
  add column if not exists dedupe_key text,
  add column if not exists import_batch_id text,
  add column if not exists review_note text,
  add column if not exists published_case_id uuid references public.cases(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists submitted_via text,
  add column if not exists contact text,
  add column if not exists ip_hash text;

alter table public.cases
  add column if not exists source_candidate_id uuid
    references public.case_candidates(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_candidates_status_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_status_check
      check (status in ('pending', 'approved', 'rejected', 'published'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_candidates_cost_band_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_cost_band_check
      check (cost_band in ('low', 'medium', 'high'));
  end if;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_evidence_level_check'
  ) then
    alter table public.cases
      add constraint cases_evidence_level_check
      check (evidence_level in ('L0', 'L1', 'L2'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_candidates_evidence_level_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_evidence_level_check
      check (evidence_level in ('L0', 'L1', 'L2'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_source_metrics_nonnegative_check'
  ) then
    alter table public.cases
      add constraint cases_source_metrics_nonnegative_check
      check (
        (source_like_count is null or source_like_count >= 0)
        and (source_comment_count is null or source_comment_count >= 0)
        and (source_share_count is null or source_share_count >= 0)
        and (source_save_count is null or source_save_count >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_candidates_source_metrics_nonnegative_check'
  ) then
    alter table public.case_candidates
      add constraint case_candidates_source_metrics_nonnegative_check
      check (
        (source_like_count is null or source_like_count >= 0)
        and (source_comment_count is null or source_comment_count >= 0)
        and (source_share_count is null or source_share_count >= 0)
        and (source_save_count is null or source_save_count >= 0)
      );
  end if;

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

create table if not exists public.case_likes (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table if not exists public.analytics_events (
  id bigint generated by default as identity primary key,
  event_name text not null,
  path text not null,
  referrer text,
  anonymous_session_id text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  message text not null,
  contact text,
  page text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_case_likes_case_id on public.case_likes(case_id);
create unique index if not exists idx_cases_source_candidate_id
  on public.cases(source_candidate_id)
  where source_candidate_id is not null;
create index if not exists idx_analytics_events_name_created_at
  on public.analytics_events(event_name, created_at desc);
create index if not exists idx_feedback_messages_status_created_at
  on public.feedback_messages(status, created_at desc);
create unique index if not exists idx_case_candidates_dedupe_key on public.case_candidates(dedupe_key);
create index if not exists idx_case_candidates_status_created_at on public.case_candidates(status, created_at desc);
create index if not exists idx_case_candidates_ip_hash_created on public.case_candidates (ip_hash, created_at desc);

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_likes enable row level security;
alter table public.case_candidates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feedback_messages enable row level security;

drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "cases are publicly readable" on public.cases;
create policy "cases are publicly readable"
on public.cases
for select
using (is_published = true);

drop policy if exists "likes are publicly readable" on public.case_likes;
create policy "likes are publicly readable"
on public.case_likes
for select
using (true);

drop policy if exists "authenticated users can like cases" on public.case_likes;
create policy "authenticated users can like cases"
on public.case_likes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "authenticated users can remove own likes" on public.case_likes;
create policy "authenticated users can remove own likes"
on public.case_likes
for delete
to authenticated
using (auth.uid() = user_id);
