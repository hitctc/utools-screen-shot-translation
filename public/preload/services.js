const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  getReadableStoredChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('./chromeBookmarks.cjs')
const {
  normalizeUiSettings,
  normalizeBookmarkCache,
  normalizePinnedBookmarkMap,
  normalizeRecentOpenedMap,
  togglePinnedBookmark,
  recordBookmarkOpen,
} = require('./localState.cjs')

const BOOKMARK_SETTINGS_KEY = 'quick-bookmarks-settings'
const BOOKMARK_UI_SETTINGS_KEY = 'quick-bookmarks-ui-settings'
const BOOKMARK_PINS_KEY = 'quick-bookmarks-pins'
const BOOKMARK_RECENT_OPENED_KEY = 'quick-bookmarks-recent-opened'

// 书签缓存只用于本机秒开首页，不走 uTools 同步数据库，避免整份书签被同步到其他设备。
function getBookmarkCacheFilePath() {
  return path.join(os.homedir(), 'Library', 'Caches', 'utools-my-quick-bookmarks', 'bookmark-cache.json')
}

// 云端同步的路径在另一台设备上可能不存在，这里只做本机可读性判断，不改动同步数据本身。
function canAccessBookmarksFile(filePath) {
  if (!filePath) {
    return false
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

// 读取本地保存的书签路径配置；如果用户还没配过，就回退到默认 Chrome 路径。
function getBookmarkSettings() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_SETTINGS_KEY) || {}
  const chromeBookmarksPath = getReadableStoredChromeBookmarksPath(
    os.homedir(),
    saved.chromeBookmarksPath,
    canAccessBookmarksFile,
  )

  return {
    chromeBookmarksPath,
  }
}

// 保存用户自定义的书签路径，并返回当前生效的设置。
function saveBookmarkSettings(chromeBookmarksPath) {
  const payload = {
    chromeBookmarksPath: String(chromeBookmarksPath ?? '').trim(),
  }

  window.utools.dbStorage.setItem(BOOKMARK_SETTINGS_KEY, payload)
  return getBookmarkSettings()
}

// 清除用户自定义路径，恢复为默认 Chrome 路径。
function resetBookmarkSettings() {
  window.utools.dbStorage.removeItem(BOOKMARK_SETTINGS_KEY)
  return getBookmarkSettings()
}

// 缓存只保留最近一次成功读取的书签树，失败时不要动旧数据。
function getBookmarkCache() {
  try {
    const filePath = getBookmarkCacheFilePath()
    if (!fs.existsSync(filePath)) {
      return null
    }

    const text = fs.readFileSync(filePath, { encoding: 'utf-8' })
    return normalizeBookmarkCache(JSON.parse(text))
  } catch {
    return null
  }
}

// 写入缓存时先归一化并落到本机缓存目录，写失败也不能影响主读取流程。
function saveBookmarkCache(rawCache) {
  const normalized = normalizeBookmarkCache({
    ...(rawCache && typeof rawCache === 'object' ? rawCache : {}),
    cachedAt: Number((rawCache && typeof rawCache === 'object' && rawCache.cachedAt) || Date.now()),
  })

  if (!normalized) {
    return null
  }

  try {
    const filePath = getBookmarkCacheFilePath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(normalized), { encoding: 'utf-8' })
    return normalized
  } catch {
    return null
  }
}

// 清空缓存只影响书签秒开数据，不动路径和其他 UI 状态。
function clearBookmarkCache() {
  try {
    const filePath = getBookmarkCacheFilePath()
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // 清缓存失败不影响主流程。
  }
  return null
}

// 首页展示相关的开关和路径配置分开存，避免后续扩展时互相覆盖。
function getBookmarkUiSettings() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_UI_SETTINGS_KEY)
  return normalizeUiSettings(saved)
}

// 设置页更新 UI 开关时，沿用已有值补齐，避免一次切换把另一个开关丢掉。
function saveBookmarkUiSettings(partial) {
  const next = normalizeUiSettings({
    ...getBookmarkUiSettings(),
    ...(partial && typeof partial === 'object' ? partial : {}),
  })

  window.utools.dbStorage.setItem(BOOKMARK_UI_SETTINGS_KEY, next)
  return next
}

// 置顶是纯本地视图状态，所以对外统一返回已经清理过的映射。
function getPinnedBookmarks() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_PINS_KEY)
  return normalizePinnedBookmarkMap(saved)
}

// 置顶开关只认书签 id，不把排序逻辑散落到渲染层里。
function togglePinnedBookmarkState(bookmarkId) {
  const next = togglePinnedBookmark(getPinnedBookmarks(), bookmarkId, Date.now())
  window.utools.dbStorage.setItem(BOOKMARK_PINS_KEY, next)
  return next
}

// 最近打开记录既要展示最近时间，也要为打开次数提供数据来源。
function getRecentOpenedBookmarks() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_RECENT_OPENED_KEY)
  return normalizeRecentOpenedMap(saved)
}

// 每次打开书签都把本地最近打开状态更新一次，前端不用重复维护计数。
function recordBookmarkOpenState(bookmarkId) {
  const next = recordBookmarkOpen(getRecentOpenedBookmarks(), bookmarkId, Date.now())
  window.utools.dbStorage.setItem(BOOKMARK_RECENT_OPENED_KEY, next)
  return next
}

// URL 统一交给系统默认浏览器处理，同时把最近打开和次数一起记下来。
function openBookmarkUrl(bookmarkId, url) {
  const targetUrl = String(url ?? '').trim()
  if (!targetUrl) {
    throw new Error('当前书签缺少可打开的地址')
  }

  window.utools.shellOpenExternal(targetUrl)
  return recordBookmarkOpenState(bookmarkId)
}

// 读取并解析 Chrome 书签文件，把底层文件或 JSON 异常整理成前端可展示的错误信息。
function loadChromeBookmarks(bookmarkPath) {
  const filePath = getEffectiveChromeBookmarksPath(os.homedir(), bookmarkPath)

  if (!fs.existsSync(filePath)) {
    throw new Error('当前书签文件路径不存在或不可访问')
  }

  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf-8' })
  } catch {
    throw new Error('当前书签文件路径不存在或不可访问')
  }

  let parsed
  try {
    parsed = parseChromeBookmarksText(text)
  } catch {
    throw new Error('书签文件不是有效的 Chrome Bookmarks JSON')
  }

  if (!parsed.items.length) {
    throw new Error('已读取文件，但没有解析出任何书签')
  }

  const result = {
    filePath,
    total: parsed.total,
    items: parsed.items,
  }

  return result
}

// 通过 window 对象向渲染进程注入当前书签工具需要的本地能力。
window.services = {
  getDefaultChromeBookmarksPath() {
    return getDefaultChromeBookmarksPath(os.homedir())
  },
  getBookmarkSettings,
  saveBookmarkSettings,
  resetBookmarkSettings,
  getBookmarkCache,
  saveBookmarkCache,
  clearBookmarkCache,
  getBookmarkUiSettings,
  saveBookmarkUiSettings,
  getPinnedBookmarks,
  togglePinnedBookmarkState,
  getRecentOpenedBookmarks,
  openBookmarkUrl,
  loadChromeBookmarks,
}
