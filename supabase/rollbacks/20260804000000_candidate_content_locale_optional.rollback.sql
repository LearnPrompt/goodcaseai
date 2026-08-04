begin;

-- 恢复 not null 之前必须先把空值填掉，否则加约束会失败。
-- 注意这会把「尚未判定」重新压成 zh-CN，也就是回到出问题时的状态。
update public.case_candidates
  set content_locale = 'zh-CN'
  where content_locale is null;

alter table public.case_candidates
  alter column content_locale set default 'zh-CN',
  alter column content_locale set not null;

commit;
