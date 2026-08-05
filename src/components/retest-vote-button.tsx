"use client";

import {
  recordLocalRetestVote,
  useHasVotedRetest,
} from "@/lib/local-retest-votes";
import { submitReaction, useReactionCounts } from "@/lib/reaction-counts";
import { useMessages } from "@/i18n/client";

/**
 * 「催复测」投票按钮，只出现在详情页稳定度那一格（稳定度缺测时）。
 * 列表卡片上的同一句文案保持纯文本，不做成交互组件——卡片是静态的。
 */
export function RetestVoteButton({ caseSlug }: { caseSlug: string }) {
  const messages = useMessages();
  const hasVoted = useHasVotedRetest(caseSlug);
  const reactions = useReactionCounts(caseSlug);

  // 后端不可用时只剩本地行为：按钮能点、能变成"已投票"，但不显示票数。
  const showCount = reactions.available;
  const voteCount = reactions.counts.retestVote;

  return (
    <button
      type="button"
      aria-pressed={hasVoted}
      disabled={hasVoted}
      onClick={() => {
        // 投过就不再重复上报。服务端还有唯一约束兜底，这里只是省一次请求。
        if (!recordLocalRetestVote(caseSlug)) {
          return;
        }
        submitReaction(caseSlug, "retest_vote", true);
      }}
      className={`gc-action whitespace-nowrap ${
        hasVoted ? "border-[var(--orange)] text-[var(--orange)]" : ""
      }`}
    >
      <span aria-hidden="true">↺</span>
      <span>
        {hasVoted ? messages.stability.voted : messages.stability.pending}
      </span>
      {showCount && voteCount > 0 ? <span>{voteCount}</span> : null}
    </button>
  );
}
