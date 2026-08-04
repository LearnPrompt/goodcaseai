begin;

-- case_candidates.content_locale 原本是 not null default 'zh-CN'，
-- 结果「上游没判定语言」和「上游判定这是中文」在库里读出来一模一样，
-- 发布阶段没法区分，只能照抄，英文 Prompt 被一路标成中文带到线上。
-- 候选表是暂存区，允许为空：空值明确表示尚未判定，由发布阶段按 Prompt 正文判定。
-- cases 是对外服务表，保持 not null，写入方 buildCasePayload 保证一定有值。
alter table public.case_candidates
  alter column content_locale drop default,
  alter column content_locale drop not null;

-- 既有的 case_candidates_content_locale_check 不用动：
-- CHECK 只在结果为 false 时拒绝，null in (...) 是 unknown，会照常通过。

commit;
