export type ScreenTranslationFeatureCode =
  | 'screen-shot-translation-run'
  | 'screen-shot-translation-records'
  | 'screen-shot-translation-settings'

export type ScreenTranslationView = 'records' | 'settings' | 'result'
export type ScreenTranslationRecord = {
  id: string
  imagePath: string
  createdAtLabel: string
  orderLabel: string
}
export type ScreenTranslationStep = 'capture' | 'translate' | 'pin'
export type TranslationMode = 'auto' | 'en-to-zh' | 'zh-to-en'
export type WorkflowFailureCode =
  | 'capture-cancelled'
  | 'translation-failed'
  | 'translation-config-invalid'
  | 'save-config-invalid'
  | 'save-failed'
  | 'pin-failed'
  | 'repin-failed'
export type ThemeMode = 'system' | 'dark' | 'light'

export type UiSettings = {
  themeMode: ThemeMode
  windowHeight: number
}

export type PluginSettings = {
  translationMode: TranslationMode
  saveTranslatedImage: boolean
  saveDirectory: string
  confirmBeforeDelete: boolean
}

export type WorkflowResultPresentation = {
  title: string
  message: string
  showRetry: boolean
  showOpenSettings: boolean
  showClose: boolean
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  themeMode: 'system',
  windowHeight: 640,
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}

export const WINDOW_HEIGHT_MIN = 480
export const WINDOW_HEIGHT_MAX = 960
export const WINDOW_HEIGHT_STEP = 20

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export const TRANSLATION_MODE_OPTIONS: Array<{ value: TranslationMode; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'en-to-zh', label: '英文 -> 中文' },
  { value: 'zh-to-en', label: '中文 -> 英文' },
]
