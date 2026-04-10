const DEFAULT_UI_SETTINGS = {
  themeMode: 'system',
  windowHeight: 640,
}

const DEFAULT_PLUGIN_SETTINGS = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}

const WINDOW_HEIGHT_MIN = 480
const WINDOW_HEIGHT_MAX = 960
const VALID_THEME_MODES = new Set(['system', 'dark', 'light'])
const VALID_TRANSLATION_MODES = new Set(['auto', 'en-to-zh', 'zh-to-en'])

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

// 插件设置只保留翻译保存相关项，读到脏值时统一回退到新的插件默认值。
function normalizePluginSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  return {
    translationMode: VALID_TRANSLATION_MODES.has(data.translationMode)
      ? data.translationMode
      : DEFAULT_PLUGIN_SETTINGS.translationMode,
    saveTranslatedImage: Boolean(data.saveTranslatedImage),
    saveDirectory: typeof data.saveDirectory === 'string' ? data.saveDirectory.trim() : '',
    confirmBeforeDelete:
      typeof data.confirmBeforeDelete === 'boolean'
        ? data.confirmBeforeDelete
        : DEFAULT_PLUGIN_SETTINGS.confirmBeforeDelete,
  }
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  normalizeUiSettings,
  normalizePluginSettings,
}
