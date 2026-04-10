const DEFAULT_UI_SETTINGS = {
  themeMode: 'system',
  windowHeight: 640,
}

const DEFAULT_PLUGIN_SETTINGS = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  pinPreviewMode: 'overlay',
}

const WINDOW_HEIGHT_MIN = 480
const WINDOW_HEIGHT_MAX = 960
const VALID_THEME_MODES = new Set(['system', 'dark', 'light'])
const VALID_PIN_PREVIEW_MODES = new Set(['overlay', 'side-by-side'])

// UI 设置只负责窗口外观相关项，读到脏值时统一回退到插件可接受的范围。
function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const themeMode = VALID_THEME_MODES.has(data.themeMode) ? data.themeMode : DEFAULT_UI_SETTINGS.themeMode
  const windowHeight = Math.floor(Number(data.windowHeight))

  return {
    themeMode,
    windowHeight:
      Number.isFinite(windowHeight) && windowHeight > 0
        ? Math.min(Math.max(windowHeight, WINDOW_HEIGHT_MIN), WINDOW_HEIGHT_MAX)
        : DEFAULT_UI_SETTINGS.windowHeight,
  }
}

// 插件设置只保留翻译语言和截图预览模式，避免旧书签状态继续混入 preload 边界。
function normalizePluginSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const sourceLanguage =
    typeof data.sourceLanguage === 'string' && data.sourceLanguage.trim()
      ? data.sourceLanguage.trim()
      : DEFAULT_PLUGIN_SETTINGS.sourceLanguage
  const targetLanguage =
    typeof data.targetLanguage === 'string' && data.targetLanguage.trim()
      ? data.targetLanguage.trim()
      : DEFAULT_PLUGIN_SETTINGS.targetLanguage
  const pinPreviewMode = VALID_PIN_PREVIEW_MODES.has(data.pinPreviewMode)
    ? data.pinPreviewMode
    : DEFAULT_PLUGIN_SETTINGS.pinPreviewMode

  return {
    sourceLanguage,
    targetLanguage,
    pinPreviewMode,
  }
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  normalizeUiSettings,
  normalizePluginSettings,
}
