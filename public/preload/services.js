const {
  normalizeUiSettings,
  normalizePluginSettings,
} = require('./localState.cjs')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'

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

// preload 只暴露新插件初始化所需的最小设置桥接，其他旧书签能力全部移除。
window.services = {
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
}
