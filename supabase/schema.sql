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
  creator_name text,
  summary text not null,
  prompt_preview text,
  prompt_full text,
  media_kind text not null,
  media_url text not null,
  poster_url text,
  remake_count int not null default 0,
  stability_score int not null default 0,
  favorite_score int not null default 0,
  recommended_models text[] not null default '{}'::text[],
  cost_band text not null default 'medium',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cases
  add column if not exists prompt_full text,
  add column if not exists remake_count int not null default 0,
  add column if not exists recommended_models text[] not null default '{}'::text[],
  add column if not exists cost_band text not null default 'medium',
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
  creator_name text,
  summary text not null,
  prompt_preview text,
  prompt_full text,
  media_kind text not null,
  media_url text not null,
  poster_url text,
  remake_count int not null default 0,
  stability_score int not null default 0,
  favorite_score int not null default 0,
  recommended_models text[] not null default '{}'::text[],
  cost_band text not null default 'medium',
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
  add column if not exists creator_name text,
  add column if not exists summary text,
  add column if not exists prompt_preview text,
  add column if not exists prompt_full text,
  add column if not exists media_kind text,
  add column if not exists media_url text,
  add column if not exists poster_url text,
  add column if not exists remake_count int not null default 0,
  add column if not exists stability_score int not null default 0,
  add column if not exists favorite_score int not null default 0,
  add column if not exists recommended_models text[] not null default '{}'::text[],
  add column if not exists cost_band text not null default 'medium',
  add column if not exists status text not null default 'pending',
  add column if not exists dedupe_key text,
  add column if not exists import_batch_id text,
  add column if not exists review_note text,
  add column if not exists published_case_id uuid references public.cases(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

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
end
$$;

create table if not exists public.case_likes (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create index if not exists idx_case_likes_case_id on public.case_likes(case_id);
create unique index if not exists idx_case_candidates_dedupe_key on public.case_candidates(dedupe_key);
create index if not exists idx_case_candidates_status_created_at on public.case_candidates(status, created_at desc);

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_likes enable row level security;
alter table public.case_candidates enable row level security;

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
