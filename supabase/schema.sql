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
  -- 列表卡片只渲染 2–3 行提示语，库侧先截断，别让整段译文走出网流量。
  prompt_preview_zh text generated always as (left(translations -> 'zh-CN' ->> 'promptFull', 240)) stored,
  prompt_preview_en text generated always as (left(translations -> 'en' ->> 'promptFull', 240)) stored,
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
  add column if not exists is_published boolean not null default true,
  add column if not exists prompt_preview_zh text
    generated always as (left(translations -> 'zh-CN' ->> 'promptFull', 240)) stored,
  add column if not exists prompt_preview_en text
    generated always as (left(translations -> 'en' ->> 'promptFull', 240)) stored;

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
  -- 可空是刻意的：空值表示上游尚未判定语言，发布阶段按 Prompt 正文判定。
  -- 给了默认值就等于让数据库替所有候选决定语言，英文 Prompt 会被标成 zh-CN。
  content_locale text,
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
  add column if not exists content_locale text,
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
  add column if not exists ip_hash text,
  -- 来源 URL 的 fragment（youmind 的 #reversed-N 等）。仅取证用，不参与 dedupe_key。
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

-- 无账号的投票 / 点赞：一张表管两种反应。身份是浏览器匿名会话不是用户，
-- 与 analytics_events.anonymous_session_id 同源；读写只走服务端 service role
-- （src/app/api/reactions/route.ts）。刻意不加 cases 外键，允许指向未发布或已下架的 slug。
-- 设计取舍的完整说明见 supabase/migrations/20260805200000_case_reactions.sql。
create table if not exists public.case_reactions (
  id bigint generated by default as identity primary key,
  case_slug text not null,
  session_id text not null,
  kind text not null check (kind in ('like', 'retest_vote')),
  created_at timestamptz not null default now()
);

comment on table public.case_reactions is
  '匿名反应（点赞 / 催复测投票）。身份是浏览器会话不是用户；读写只走服务端 service role。';
comment on column public.case_reactions.case_slug is
  '对应 cases.slug。刻意不加外键，允许指向未发布或已下架的 slug。';
comment on column public.case_reactions.session_id is
  '匿名会话 ID，与 analytics_events.anonymous_session_id 同源。';

-- 防重：同一会话 + 同一案例 + 同一种反应只留一行。
create unique index if not exists case_reactions_session_kind_key
  on public.case_reactions (case_slug, session_id, kind);
create index if not exists case_reactions_slug_kind_idx
  on public.case_reactions (case_slug, kind);

-- Agent API 的 key 与用量。只存 sha-256 hash，明文只在签发那一刻打印一次；
-- 读写只走服务端 service role。持有者是"一个调用方程序"而不是"一个用户"，
-- 所以不复用账号体系。设计取舍的完整说明见
-- supabase/migrations/20260807000000_agent_api_keys.sql。
create table if not exists public.api_keys (
  id bigint generated by default as identity primary key,
  key_hash text not null unique,
  name text not null,
  daily_limit integer not null default 2000,
  status text not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint api_keys_key_hash_shape_check
    check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_keys_name_not_blank_check
    check (length(btrim(name)) between 1 and 80),
  constraint api_keys_daily_limit_range_check
    check (daily_limit between 1 and 1000000),
  constraint api_keys_status_check
    check (status in ('active', 'revoked')),
  -- 吊销必须留下时间：没有吊销时间的 revoked 行事后无法回答"什么时候停的"。
  constraint api_keys_revoked_at_check
    check ((status = 'revoked') = (revoked_at is not null))
);

comment on table public.api_keys is
  'Agent API key。只存 sha-256 hash，明文只在签发时打印一次；读写只走服务端 service role。';
comment on column public.api_keys.key_hash is
  '明文 key（gc_ 前缀 + hex 随机串）的 sha-256 十六进制摘要。唯一。';
comment on column public.api_keys.name is
  '运营备注名，用于事后认领和吊销。不参与任何鉴权逻辑。';
comment on column public.api_keys.daily_limit is
  '每 UTC 自然日的请求上限，由 consume_api_quota 强制执行。';
comment on column public.api_keys.last_used_at is
  '当日首次调用时更新一次，不是每请求更新——只为回答"这把 key 还活着吗"。';

-- 唯一约束已经建了索引，验证路径的 where key_hash = $1 直接命中。
-- 这个部分索引服务的是运营视角的"列出还在用的 key"。
create index if not exists api_keys_active_idx
  on public.api_keys (created_at desc)
  where status = 'active';

-- 按 (key, UTC 日期) 聚合的调用计数，一天一行 upsert，不是逐请求明细表。
-- 与 case_reactions 的取舍相反：这张表必须加外键且 on delete cascade——
-- 用量行脱离 key 之后没有任何意义。
create table if not exists public.api_usage (
  api_key_id bigint not null
    references public.api_keys (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (api_key_id, usage_date),
  constraint api_usage_request_count_check check (request_count >= 0)
);

comment on table public.api_usage is
  '按 (key, UTC 日期) 聚合的调用计数，一天一行 upsert。不是逐请求明细表。';
comment on column public.api_usage.usage_date is
  'UTC 自然日。刻意不用本地时区——函数跑在哪个区域不确定，UTC 是唯一一致的切分。';

-- 运营视角的"最近谁在用"。主键已经覆盖了按 key 查当日用量的路径。
create index if not exists api_usage_date_idx
  on public.api_usage (usage_date desc);

-- 复测证据：脚本只写产物（case_slug / tested_at / model / artifact_url），
-- verdict 与 notes 一律留 null 等人填，脚本永远不碰 cases.stability_score。
-- 同一条案例可以有多行，刻意不做唯一约束——复测的价值在时间序列上。
-- 引用案例用 slug 而不是外键，理由同 case_reactions：复现失败的案例最可能被下架。
-- 设计取舍的完整说明见 supabase/migrations/20260807010000_case_retests.sql。
create table if not exists public.case_retests (
  id bigint generated by default as identity primary key,
  case_slug text not null,
  tested_at timestamptz not null default now(),
  model text not null,
  artifact_url text,
  verdict text check (verdict is null or verdict in ('reproduced', 'degraded', 'failed', 'inconclusive')),
  notes text,
  operator text,
  created_at timestamptz not null default now()
);

comment on table public.case_retests is
  '复测证据。脚本只写产物，verdict / notes 由人填；本表不驱动 cases.stability_score 自动更新。';
comment on column public.case_retests.case_slug is
  '对应 cases.slug。刻意不加外键，允许指向已下架的 slug——复现失败的案例最可能被下架。';
comment on column public.case_retests.model is
  '实际跑复测的模型标识，例如 codex-builtin-image-generation / gpt-5.6-sol。同一条案例换模型重测要另起一行。';
comment on column public.case_retests.artifact_url is
  'Vercel Blob 上的复现产物公开 URL。为空表示这次复测没拿到产物（模型拒绝 / 超时），这本身也是证据。';
comment on column public.case_retests.verdict is
  '人审结论，脚本永远写 null。收敛出稳定档位之前先用 check 约束而不是 enum。';

-- 主查询是「按 slug 取这条案例的全部复测记录，按时间倒序展示」，
-- 这个顺序一次服务单 slug 详情和 slug in (...) 的批量取数，且直接给出排好序的结果。
create index if not exists case_retests_slug_tested_at_idx
  on public.case_retests (case_slug, tested_at desc);

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
alter table public.case_reactions enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.case_retests enable row level security;

-- 这四张表一条 policy 都不建，是故意的，不是漏写。
-- RLS 开启且无 policy 时 anon / authenticated 的任何读写都被拒；service role 绕过 RLS，
-- 服务端 API route 照常工作。再显式收一次表级权限兜底 disable RLS 的手滑场景。
-- 将来真要在前端直连读复测记录，除了加 select policy 还得把 select 权限 grant 回来——
-- 这一步故意留成必须显式做的动作。别顺手 grant insert/update。
revoke all on public.case_reactions from anon;
revoke all on public.case_reactions from authenticated;
revoke all on public.api_keys from anon;
revoke all on public.api_keys from authenticated;
revoke all on public.api_usage from anon;
revoke all on public.api_usage from authenticated;
revoke all on public.case_retests from anon;
revoke all on public.case_retests from authenticated;

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

-- consume_api_quota：原子的「查用量 → 判限额 → 计数 +1」。
--
-- 存在的唯一理由是把这三步放进同一个行级锁里。应用层 select-then-update 有竞态：
-- 同一把 key 的并发请求读到同一个旧值各自 +1 写回，计数少算、超额也放得过去。
--
-- 返回 (allowed, used)：
--   allowed = false 时不计数，used 是当前已用量（此时 used >= p_limit）。
--   allowed = true  时 used 是**计数之后**的值，应用层据此算 remaining = limit - used。
--   所以 limit = 100 时，第 100 次调用返回 (true, 100)、remaining = 0，第 101 次返回 (false, 100)。
create or replace function public.consume_api_quota(
  p_key_id bigint,
  p_day date,
  p_limit integer
)
returns table (allowed boolean, used integer)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
  v_fresh boolean := false;
begin
  -- 先保证今天这一行存在。并发下只有一个事务能插入成功，其余走 do nothing，
  -- 随后统一由下面的 for update 拿锁读值，两条路径汇合。
  insert into public.api_usage (api_key_id, usage_date, request_count)
  values (p_key_id, p_day, 0)
  on conflict (api_key_id, usage_date) do nothing;

  -- for update：从这里到 commit，这把 key 今天的行被独占。
  -- 判断和扣减必须在同一个锁区间内，这是整个函数存在的唯一理由。
  select request_count into v_used
    from public.api_usage
   where api_key_id = p_key_id
     and usage_date = p_day
   for update;

  if v_used is null then
    -- 理论上不可达（上面刚保证了行存在），但真发生了就当配额用尽拒绝，
    -- 而不是当作 0 放行——不确定的时候倾向于拒绝，别把配额漏出去。
    return query select false, p_limit;
    return;
  end if;

  if v_used >= p_limit then
    return query select false, v_used;
    return;
  end if;

  v_fresh := (v_used = 0);

  update public.api_usage
     set request_count = request_count + 1,
         updated_at = now()
   where api_key_id = p_key_id
     and usage_date = p_day
  returning request_count into v_used;

  -- last_used_at 只在当日首次调用时写一次。每请求都写的话，这一行会成为
  -- 每次调用都要更新的热行，白白制造行版本和 vacuum 压力，
  -- 而它要回答的问题（这把 key 还活着吗）精确到天就够了。
  if v_fresh then
    update public.api_keys
       set last_used_at = now()
     where id = p_key_id;
  end if;

  return query select true, v_used;
end;
$$;

comment on function public.consume_api_quota(bigint, date, integer) is
  '原子地判限额并计数 +1。security definer + RLS 全锁，只允许 service role 调用。';

-- security definer 的函数默认对 public 可执行，必须显式收回：
-- 否则 anon 能直接 rpc 调它去消耗别人的配额（虽然拿不到 key，但能猜 id 刷计数）。
revoke all on function public.consume_api_quota(bigint, date, integer) from public;
revoke all on function public.consume_api_quota(bigint, date, integer) from anon;
revoke all on function public.consume_api_quota(bigint, date, integer) from authenticated;
