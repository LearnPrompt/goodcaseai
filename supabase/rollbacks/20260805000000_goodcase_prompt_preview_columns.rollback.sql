begin;

-- 生成列不存原始数据，删掉不会丢内容：值随时能从 translations 重新算出来。
-- 回滚前先把应用回退到不依赖这两列的版本，
-- src/lib/cases.ts 有 42703 降级路径，可以直接退回整段译文继续跑。
alter table public.cases
  drop column if exists prompt_preview_zh,
  drop column if exists prompt_preview_en;

commit;

notify pgrst, 'reload schema';
