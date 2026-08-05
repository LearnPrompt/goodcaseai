"use client";

import { useReactionCounts } from "@/lib/reaction-counts";
import { useMessages } from "@/i18n/client";

/**
 * 稳定度格子/首页深度 Case 里「投票催复测」文案的票数徽标。
 *
 * 订阅的是 reaction-counts.ts 里的全局单例 store——LikeButton、
 * RetestVoteButton 都在用同一份，一页只会合并成一条 /api/reactions
 * 批量请求，这里不额外发请求。
 *
 * 粒度收在这一个小组件：只有它会因计数更新而重渲染，不会带动整张卡片
 * （case-card.tsx / home-case-deck.tsx）重渲染。
 *
 * 票数为 0 或后端不可用（表未建 / 未配 key / 网络失败）时只显示纯文本，
 * 不追加数字——跟详情页 RetestVoteButton 的降级逻辑保持一致。
 */
export function CaseCardStabilityVote({ caseSlug }: { caseSlug: string }) {
  const messages = useMessages();
  const reactions = useReactionCounts(caseSlug);
  const voteCount = reactions.counts.retestVote;

  if (!reactions.available || voteCount <= 0) {
    return <>{messages.stability.pending}</>;
  }

  return (
    <>
      {messages.stability.pending} · {voteCount}
    </>
  );
}
