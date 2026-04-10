const VALID_TRANSLATION_MODES = new Set(['auto', 'en-to-zh', 'zh-to-en'])
const DEFAULT_PLUGIN_SETTINGS = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}

// 前端和 preload 共用同一套插件设置骨架，任何脏值都只允许回落到默认字段。
export function normalizePluginSettings(raw) {
  const candidate = raw && typeof raw === 'object' ? raw : {}

  return {
    translationMode: VALID_TRANSLATION_MODES.has(String(candidate.translationMode))
      ? String(candidate.translationMode)
      : DEFAULT_PLUGIN_SETTINGS.translationMode,
    saveTranslatedImage:
      typeof candidate.saveTranslatedImage === 'boolean'
        ? candidate.saveTranslatedImage
        : DEFAULT_PLUGIN_SETTINGS.saveTranslatedImage,
    saveDirectory:
      typeof candidate.saveDirectory === 'string'
        ? candidate.saveDirectory.trim()
        : DEFAULT_PLUGIN_SETTINGS.saveDirectory,
    confirmBeforeDelete:
      typeof candidate.confirmBeforeDelete === 'boolean'
        ? candidate.confirmBeforeDelete
        : DEFAULT_PLUGIN_SETTINGS.confirmBeforeDelete,
  }
}

// 保存目录还没接目录选择器时，先用这条提示把“已开启但没路径”的状态显式暴露出来。
export function getSaveDirectoryWarning(pluginSettings) {
  if (pluginSettings.saveTranslatedImage && !pluginSettings.saveDirectory.trim()) {
    return '已开启保存结果图片，但保存目录为空，请先填写保存目录。'
  }

  return ''
}
