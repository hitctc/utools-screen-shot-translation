const VALID_TRANSLATION_MODES = new Set(['auto', 'en-to-zh', 'zh-to-en'])
const DEFAULT_PLUGIN_SETTINGS = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}
const DEFAULT_TRANSLATION_CREDENTIALS = {
  appId: '',
  appKey: '',
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

// 同步凭证只保留百度翻译当前需要的两个字段，避免把数据库元信息带到前端。
export function normalizeTranslationCredentials(raw) {
  const candidate = raw && typeof raw === 'object' ? raw : {}

  return {
    appId: typeof candidate.appId === 'string' ? candidate.appId.trim() : DEFAULT_TRANSLATION_CREDENTIALS.appId,
    appKey: typeof candidate.appKey === 'string' ? candidate.appKey.trim() : DEFAULT_TRANSLATION_CREDENTIALS.appKey,
  }
}

// 凭证只要有一项缺失，就在设置页显式提醒用户不要以为已经可用。
export function getTranslationCredentialWarning(credentials) {
  const normalized = normalizeTranslationCredentials(credentials)
  if ((normalized.appId && !normalized.appKey) || (!normalized.appId && normalized.appKey)) {
    return '百度图片翻译凭证尚未填写完整，请同时提供 AppID 和 AppKey。'
  }

  return ''
}
