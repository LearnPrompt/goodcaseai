/**
 * 在保持优先级尽量不变的前提下，避免默认浏览连续刷出同一作者。
 * 搜索结果不使用这个函数，以免破坏相关度排序。
 *
 * 注意这是「尽量」不是「保证」：剩余候选全是同一作者时会退回原顺序继续排，
 * 否则就得丢条目。列表尾部因此仍可能出现长于 maxConsecutive 的同作者连排。
 */
type CreatorLike = {
  creator?: string | null;
  creatorName?: string | null;
};

export function diversifyByCreator<T extends CreatorLike>(
  items: T[],
  { maxConsecutive = 2 }: { maxConsecutive?: number } = {}
): T[] {
  if (maxConsecutive < 1 || items.length < 2) return [...items];

  const creatorOf = (item: T) => item.creator || item.creatorName || null;
  const remaining = [...items];
  const result: T[] = [];
  let lastCreator: string | null = null;
  let consecutive = 0;

  while (remaining.length > 0) {
    let index = remaining.findIndex(
      (item) => creatorOf(item) !== lastCreator || consecutive < maxConsecutive
    );
    if (index < 0) index = 0;

    const [next] = remaining.splice(index, 1);
    const creator = creatorOf(next);
    if (creator === lastCreator) consecutive += 1;
    else {
      lastCreator = creator;
      consecutive = 1;
    }
    result.push(next);
  }

  return result;
}
