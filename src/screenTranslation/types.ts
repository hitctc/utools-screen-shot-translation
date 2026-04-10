export type ScreenTranslationView = 'home' | 'settings'
export type ScreenTranslationStep = 'capture' | 'translate' | 'pin'
export type ThemeMode = 'system' | 'dark' | 'light'
export type PinPreviewMode = 'overlay' | 'side-by-side'

export type UiSettings = {
  themeMode: ThemeMode
  windowHeight: number
}

export type PluginSettings = {
  sourceLanguage: string
  targetLanguage: string
  pinPreviewMode: PinPreviewMode
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  themeMode: 'system',
  windowHeight: 640,
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  pinPreviewMode: 'overlay',
}

export const WINDOW_HEIGHT_MIN = 480
export const WINDOW_HEIGHT_MAX = 960
export const WINDOW_HEIGHT_STEP = 20

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export const SOURCE_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

export const TARGET_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

export const PIN_PREVIEW_OPTIONS: Array<{ value: PinPreviewMode; label: string }> = [
  { value: 'overlay', label: '覆盖原图' },
  { value: 'side-by-side', label: '并排预览' },
]
