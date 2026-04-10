const DEFAULT_UI_SETTINGS = {
  showRecentOpened: true,
  showOpenCount: true,
  themeMode: 'system',
  windowHeight: 640,
}
const WINDOW_HEIGHT_MIN = 480
const WINDOW_HEIGHT_MAX = 960

const VALID_THEME_MODES = new Set(['system', 'dark', 'light'])

// 缓存里的单个书签条目必须保留最基本的可用字段，方便前端直接消费。
function normalizeBookmarkCacheItem(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const id = typeof data.id === 'string' ? data.id.trim() : ''
  const url = typeof data.url === 'string' ? data.url.trim() : ''
  const sourceRoot = typeof data.sourceRoot === 'string' ? data.sourceRoot.trim() : ''

  if (!id || !url || !sourceRoot) {
    return null
  }

  const folderPath = Array.isArray(data.folderPath)
    ? data.folderPath
        .filter(segment => typeof segment === 'string' && segment.trim())
        .map(segment => segment.trim())
    : []
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const dateAdded = typeof data.dateAdded === 'string' ? data.dateAdded.trim() : ''

  return {
    id,
    url,
    sourceRoot,
    folderPath,
    title,
    dateAdded,
  }
}

// 书签缓存用于秒开首页，所以这里会把脏结构统一清理成稳定对象。
function normalizeBookmarkCache(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const filePath = typeof data.filePath === 'string' ? data.filePath.trim() : ''
  const cachedAt = Math.floor(Number(data.cachedAt))
  const items = Array.isArray(data.items)
    ? data.items
        .map(normalizeBookmarkCacheItem)
        .filter(Boolean)
    : []

  if (!filePath || !Number.isFinite(cachedAt) || cachedAt <= 0 || !items.length) {
    return null
  }

  return {
    filePath,
    total: items.length,
    items,
    cachedAt,
  }
}

// 统一把设置对象补齐为前端可以直接消费的开关结构。
function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const themeMode = VALID_THEME_MODES.has(data.themeMode) ? data.themeMode : DEFAULT_UI_SETTINGS.themeMode
  const windowHeight = Math.floor(Number(data.windowHeight))
  const normalizedWindowHeight = Number.isFinite(windowHeight) && windowHeight > 0
    ? Math.min(Math.max(windowHeight, WINDOW_HEIGHT_MIN), WINDOW_HEIGHT_MAX)
    : DEFAULT_UI_SETTINGS.windowHeight

  return {
    showRecentOpened:
      typeof data.showRecentOpened === 'boolean'
        ? data.showRecentOpened
        : DEFAULT_UI_SETTINGS.showRecentOpened,
    showOpenCount:
      typeof data.showOpenCount === 'boolean'
        ? data.showOpenCount
        : DEFAULT_UI_SETTINGS.showOpenCount,
    themeMode,
    windowHeight: normalizedWindowHeight,
  }
}

// 读取置顶映射前先清理脏数据，避免历史异常值污染排序。
function normalizePinnedBookmarkMap(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const next = {}

  for (const [bookmarkId, pinnedAt] of Object.entries(data)) {
    if (!bookmarkId) {
      continue
    }

    const timestamp = Number(pinnedAt)
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      continue
    }

    next[bookmarkId] = timestamp
  }

  return next
}

// 最近打开记录需要同时保留时间和次数，所以这里顺手做一次结构归一化。
function normalizeRecentOpenedMap(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const next = {}

  for (const [bookmarkId, record] of Object.entries(data)) {
    if (!bookmarkId || !record || typeof record !== 'object') {
      continue
    }

    const openedAt = Number(record.openedAt)
    const openCount = Math.floor(Number(record.openCount))
    if (!Number.isFinite(openedAt) || openedAt <= 0) {
      continue
    }
    if (!Number.isFinite(openCount) || openCount <= 0) {
      continue
    }

    next[bookmarkId] = {
      bookmarkId,
      openedAt,
      openCount,
    }
  }

  return next
}

// 置顶是纯插件内状态，再点一次就取消，不动源书签顺序。
function togglePinnedBookmark(currentMap, bookmarkId, now) {
  const normalized = normalizePinnedBookmarkMap(currentMap)
  if (!bookmarkId) {
    return normalized
  }

  const next = { ...normalized }
  if (next[bookmarkId]) {
    delete next[bookmarkId]
    return next
  }

  next[bookmarkId] = Number(now)
  return normalizePinnedBookmarkMap(next)
}

// 每次打开书签都更新最后打开时间，并把次数累加到本地记录里。
function recordBookmarkOpen(currentMap, bookmarkId, now) {
  const normalized = normalizeRecentOpenedMap(currentMap)
  if (!bookmarkId) {
    return normalized
  }

  const previous = normalized[bookmarkId]
  return {
    ...normalized,
    [bookmarkId]: {
      bookmarkId,
      openedAt: Number(now),
      openCount: previous ? previous.openCount + 1 : 1,
    },
  }
}

// 首页普通模式要把置顶项提到最前面，但同组内部尽量保持原始顺序。
function sortBookmarksByPinnedAndOrder(items, pinnedMap) {
  const normalized = normalizePinnedBookmarkMap(pinnedMap)

  return [...items].sort((left, right) => {
    const leftPinnedAt = Number(normalized[left.id] || 0)
    const rightPinnedAt = Number(normalized[right.id] || 0)

    if (leftPinnedAt && rightPinnedAt) {
      return leftPinnedAt - rightPinnedAt
    }
    if (leftPinnedAt || rightPinnedAt) {
      return leftPinnedAt ? -1 : 1
    }
    return 0
  })
}

// 最近打开区块只关心打开过的书签，并按最近时间倒序展示。
function sortBookmarksByRecentOpen(items, recentMap) {
  const normalized = normalizeRecentOpenedMap(recentMap)

  return [...items].sort((left, right) => {
    const leftRecord = normalized[left.id]
    const rightRecord = normalized[right.id]
    const leftOpenedAt = Number(leftRecord?.openedAt || 0)
    const rightOpenedAt = Number(rightRecord?.openedAt || 0)

    if (leftOpenedAt !== rightOpenedAt) {
      return rightOpenedAt - leftOpenedAt
    }

    return Number(rightRecord?.openCount || 0) - Number(leftRecord?.openCount || 0)
  })
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  normalizeBookmarkCache,
  normalizeUiSettings,
  normalizePinnedBookmarkMap,
  normalizeRecentOpenedMap,
  togglePinnedBookmark,
  recordBookmarkOpen,
  sortBookmarksByPinnedAndOrder,
  sortBookmarksByRecentOpen,
}
