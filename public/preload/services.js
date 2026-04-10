const {
  normalizeUiSettings,
  normalizePluginSettings,
} = require('./localState.cjs')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'
const LEGACY_BOOKMARK_SETTINGS_KEY = 'quick-bookmarks-settings'
const LEGACY_UI_SETTINGS_FALLBACK = {
  showRecentOpened: true,
  showOpenCount: true,
}

// 渲染层每次读取 UI 设置时都先走归一化，保证主题和窗口高度字段始终完整。
function getUiSettings() {
  return normalizeUiSettings(window.utools.dbStorage.getItem(UI_SETTINGS_KEY))
}

// 保存 UI 设置时只合并允许透出的字段，避免旧 preload 状态再次写回存储。
function saveUiSettings(partial) {
  const next = normalizeUiSettings({
    ...getUiSettings(),
    ...(partial && typeof partial === 'object' ? partial : {}),
  })

  window.utools.dbStorage.setItem(UI_SETTINGS_KEY, next)
  return next
}

// 插件设置只服务于截图翻译能力，读取时统一补齐默认语种和预览模式。
function getPluginSettings() {
  return normalizePluginSettings(window.utools.dbStorage.getItem(PLUGIN_SETTINGS_KEY))
}

// 持久化插件设置时保留已有有效值，避免局部更新把另一个字段清空。
function savePluginSettings(partial) {
  const next = normalizePluginSettings({
    ...getPluginSettings(),
    ...(partial && typeof partial === 'object' ? partial : {}),
  })

  window.utools.dbStorage.setItem(PLUGIN_SETTINGS_KEY, next)
  return next
}

// 过渡兼容层：Task 4 替换旧 App 之前，旧界面还会读这些旧方法，这里只提供不崩溃的最小桥接。
function getBookmarkSettings() {
  const saved = window.utools.dbStorage.getItem(LEGACY_BOOKMARK_SETTINGS_KEY)
  return {
    chromeBookmarksPath: typeof saved?.chromeBookmarksPath === 'string' ? saved.chromeBookmarksPath.trim() : '',
  }
}

// 过渡兼容层：旧设置页仍会保存书签路径，所以这里继续写回旧 key，等 Task 4 一并删除。
function saveBookmarkSettings(chromeBookmarksPath) {
  const next = {
    chromeBookmarksPath: String(chromeBookmarksPath ?? '').trim(),
  }

  window.utools.dbStorage.setItem(LEGACY_BOOKMARK_SETTINGS_KEY, next)
  return next
}

// 过渡兼容层：旧 App 点击重置时只需要拿到一个稳定结构，不要求恢复历史 preload 逻辑。
function resetBookmarkSettings() {
  window.utools.dbStorage.setItem(LEGACY_BOOKMARK_SETTINGS_KEY, { chromeBookmarksPath: '' })
  return getBookmarkSettings()
}

// 过渡兼容层：旧首页首屏缓存能力已在 Task 3 移除，这里只保留安全空实现避免直接崩溃。
function getBookmarkCache() {
  return null
}

// 过渡兼容层：旧缓存写入不再真正落盘，Task 4 替换骨架后会一起移除。
function saveBookmarkCache() {
  return null
}

// 过渡兼容层：旧缓存删除在当前阶段无需实际动作。
function clearBookmarkCache() {
  return null
}

// 过渡兼容层：旧 App 还在读取旧 UI 设置名，这里把新模型映射回旧结构。
function getBookmarkUiSettings() {
  return {
    ...LEGACY_UI_SETTINGS_FALLBACK,
    ...getUiSettings(),
  }
}

// 过渡兼容层：旧界面仍按旧方法名更新 UI 设置，底层仍统一写入新 UI settings key。
function saveBookmarkUiSettings(partial) {
  return {
    ...LEGACY_UI_SETTINGS_FALLBACK,
    ...saveUiSettings(partial),
  }
}

// 过渡兼容层：旧置顶与最近打开状态已下线，这里返回空对象维持旧页面数据流。
function getPinnedBookmarks() {
  return {}
}

// 过渡兼容层：旧页面切换置顶时不再持久化，只返回空映射避免方法缺失崩溃。
function togglePinnedBookmarkState() {
  return {}
}

// 过渡兼容层：旧最近打开状态已移除，这里保留稳定空结构。
function getRecentOpenedBookmarks() {
  return {}
}

// 过渡兼容层：仍允许旧页面打开 URL，但不再维护最近打开本地状态。
function openBookmarkUrl(_bookmarkId, url) {
  const targetUrl = String(url ?? '').trim()
  if (!targetUrl) {
    throw new Error('当前书签缺少可打开的地址')
  }

  if (typeof window.utools?.shellOpenExternal === 'function') {
    window.utools.shellOpenExternal(targetUrl)
  }

  return {}
}

// 过渡兼容层：旧书签解析器已移除，这里抛出受控错误，让旧界面进入已存在的错误展示分支。
function loadChromeBookmarks() {
  throw new Error('旧书签预加载桥接已停用，等待 Task 4 替换前端骨架')
}

// preload 同时保留新 API 和 Task 4 前的旧方法兼容层，避免中间态直接崩溃。
window.services = {
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
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
