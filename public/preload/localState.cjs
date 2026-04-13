const DEFAULT_UI_SETTINGS = {
  themeMode: 'system',
  windowHeight: 640,
  recordsColumnCount: 4,
}

const DEFAULT_PLUGIN_SETTINGS = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}

const WINDOW_HEIGHT_MIN = 480
const WINDOW_HEIGHT_MAX = 960
const RECORDS_COLUMN_COUNT_OPTIONS = [3, 4, 5]
const RECORDS_COLUMN_COUNT_MIN = 3
const RECORDS_COLUMN_COUNT_MAX = 5
const VALID_THEME_MODES = new Set(['system', 'dark', 'light'])
const VALID_TRANSLATION_MODES = new Set(['auto', 'en-to-zh', 'zh-to-en'])
const VALID_RECORDS_COLUMN_COUNTS = new Set(RECORDS_COLUMN_COUNT_OPTIONS)

// UI 设置只负责窗口外观相关项，读到脏值时统一回退到插件可接受的范围。
function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const themeMode = VALID_THEME_MODES.has(data.themeMode) ? data.themeMode : DEFAULT_UI_SETTINGS.themeMode
  const windowHeight = Math.floor(Number(data.windowHeight))
  const recordsColumnCount = Math.floor(Number(data.recordsColumnCount))

  return {
    themeMode,
    windowHeight:
      Number.isFinite(windowHeight) && windowHeight > 0
        ? Math.min(Math.max(windowHeight, WINDOW_HEIGHT_MIN), WINDOW_HEIGHT_MAX)
        : DEFAULT_UI_SETTINGS.windowHeight,
    recordsColumnCount:
      Number.isFinite(recordsColumnCount) && recordsColumnCount > 0
        ? VALID_RECORDS_COLUMN_COUNTS.has(recordsColumnCount)
          ? recordsColumnCount
          : Math.min(Math.max(recordsColumnCount, RECORDS_COLUMN_COUNT_MIN), RECORDS_COLUMN_COUNT_MAX)
        : DEFAULT_UI_SETTINGS.recordsColumnCount,
  }
}

// 插件设置只保留翻译保存相关项，读到脏值时统一回退到新的插件默认值。
function normalizePluginSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  return {
    translationMode: VALID_TRANSLATION_MODES.has(data.translationMode)
      ? data.translationMode
      : DEFAULT_PLUGIN_SETTINGS.translationMode,
    saveTranslatedImage:
      typeof data.saveTranslatedImage === 'boolean'
        ? data.saveTranslatedImage
        : DEFAULT_PLUGIN_SETTINGS.saveTranslatedImage,
    saveDirectory: typeof data.saveDirectory === 'string' ? data.saveDirectory.trim() : '',
    confirmBeforeDelete:
      typeof data.confirmBeforeDelete === 'boolean'
        ? data.confirmBeforeDelete
        : DEFAULT_PLUGIN_SETTINGS.confirmBeforeDelete,
  }
}

// 局部更新只覆盖合法字段，脏 partial 只会沿用当前已经持久化的值。
function mergePluginSettings(current, partial) {
  const base = normalizePluginSettings(current)
  const patch = partial && typeof partial === 'object' ? partial : {}

  return {
    translationMode: VALID_TRANSLATION_MODES.has(patch.translationMode)
      ? patch.translationMode
      : base.translationMode,
    saveTranslatedImage:
      typeof patch.saveTranslatedImage === 'boolean' ? patch.saveTranslatedImage : base.saveTranslatedImage,
    saveDirectory: typeof patch.saveDirectory === 'string' ? patch.saveDirectory.trim() : base.saveDirectory,
    confirmBeforeDelete:
      typeof patch.confirmBeforeDelete === 'boolean' ? patch.confirmBeforeDelete : base.confirmBeforeDelete,
  }
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  RECORDS_COLUMN_COUNT_OPTIONS,
  normalizeUiSettings,
  normalizePluginSettings,
  mergePluginSettings,
}
