/**
 * 在保持优先级尽量不变的前提下，避免默认浏览连续刷出同一作者。
 * 搜索结果不使用这个函数，以免破坏相关度排序。
 */
export function diversifyByCreator(items, { maxConsecutive = 2 } = {}) {
  if (maxConsecutive < 1 || items.length < 2) return [...items];

  const remaining = [...items];
  const result = [];
  let lastCreator = null;
  let consecutive = 0;

  while (remaining.length > 0) {
    let index = remaining.findIndex((item) => {
      const creator = item.creator || item.creatorName || null;
      return creator !== lastCreator || consecutive < maxConsecutive;
    });
    if (index < 0) index = 0;

    const [next] = remaining.splice(index, 1);
    const creator = next.creator || next.creatorName || null;
    if (creator === lastCreator) consecutive += 1;
    else {
      lastCreator = creator;
      consecutive = 1;
    }
    result.push(next);
  }

  return result;
}

