// 搜索结果沿用首页的置顶优先规则，避免搜索模式和普通模式的排序体验割裂。
export function sortItemsPinnedFirst(items, pinnedMap) {
  const normalizedItems = Array.isArray(items) ? items : []
  const normalizedPinnedMap = pinnedMap && typeof pinnedMap === 'object' ? pinnedMap : {}

  return [...normalizedItems].sort((left, right) => {
    const leftPinnedAt = Number(normalizedPinnedMap[left?.id] || 0)
    const rightPinnedAt = Number(normalizedPinnedMap[right?.id] || 0)

    if (leftPinnedAt && rightPinnedAt) {
      return leftPinnedAt - rightPinnedAt
    }

    if (leftPinnedAt || rightPinnedAt) {
      return leftPinnedAt ? -1 : 1
    }

    return 0
  })
}
