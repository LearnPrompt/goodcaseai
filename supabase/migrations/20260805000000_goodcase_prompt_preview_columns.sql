begin;

-- 列表页只渲染 2–3 行提示语，却要把整段译文 promptFull 拉过网络。
-- 314 条已发布 Case 里 zh-CN 译文中位 523 字符、最长 13138 字符，
-- 只译文这一项就占了全表出网的一半以上。
--
-- PostgREST 的 select 不能调函数，所以截断必须落在库侧。
-- left() 和 jsonb 的 -> / ->> 都是 immutable，可以直接建 STORED generated column；
-- 240 与 cases.prompt_preview 现有的截断长度对齐，卡片上视觉一致。
alter table public.cases
  add column if not exists prompt_preview_zh text
    generated always as (left(translations -> 'zh-CN' ->> 'promptFull', 240)) stored,
  add column if not exists prompt_preview_en text
    generated always as (left(translations -> 'en' ->> 'promptFull', 240)) stored;

comment on column public.cases.prompt_preview_zh is
  'Generated: first 240 chars of translations->zh-CN->>promptFull, for list cards only.';

comment on column public.cases.prompt_preview_en is
  'Generated: first 240 chars of translations->en->>promptFull, for list cards only.';

commit;

-- 新列要让 PostgREST 立刻可见，否则 REST 层仍报 42703。
notify pgrst, 'reload schema';
