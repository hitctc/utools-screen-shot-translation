const {
  normalizeUiSettings,
  normalizePluginSettings,
  mergePluginSettings,
} = require('./localState.cjs')
const { listSavedRecords, deleteSavedRecord } = require('./recordStore.cjs')
const { runMainWorkflow } = require('./workflow.cjs')
const { translateCapturedImage } = require('./baiduPictureTranslate.cjs')
const {
  getTranslationCredentials,
  saveTranslationCredentials,
} = require('./translationCredentialStore.cjs')
const { captureImageWithCustomOverlay } = require('./customCapture.cjs')
const {
  pinTranslatedImage,
  attachPinnedRecord,
  repinSavedRecordImage,
} = require('./pinWindowManager.cjs')
const fs = require('fs')
const path = require('path')

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

// 插件设置只服务于截图翻译能力，读取时统一补齐保存和删除相关默认值。
function getPluginSettings() {
  return normalizePluginSettings(window.utools.dbStorage.getItem(PLUGIN_SETTINGS_KEY))
}

// 持久化插件设置时保留已有有效值，避免局部更新把另一个字段清空。
function savePluginSettings(partial) {
  const next = mergePluginSettings(getPluginSettings(), partial)

  window.utools.dbStorage.setItem(PLUGIN_SETTINGS_KEY, next)
  return next
}

// 百度凭证单独放到同步数据库文档，避免和普通 UI/插件开关混在一起。
function readTranslationCredentials() {
  return getTranslationCredentials(window.utools?.db)
}

// 设置页写凭证时也走同一份同步文档，便于多设备跟着 uTools 账号同步。
function writeTranslationCredentials(partial) {
  return saveTranslationCredentials(window.utools?.db, partial)
}

function toFileUrl(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return ''
  }

  if (filePath.startsWith('file://')) {
    return filePath
  }

  if (/^[A-Za-z]:[\\/]/.test(filePath)) {
    return `file:///${encodeURI(filePath.replace(/\\/g, '/'))}`
  }

  if (filePath.startsWith('/')) {
    return `file://${encodeURI(filePath)}`
  }

  return filePath
}

// 钉住窗口拖动结束后，要把最后成功停留的位置写回记录清单。
function createPersistPinnedRecordBounds(settings) {
  return (recordId, bounds) =>
    typeof recordId === 'string' && recordId.trim()
      ? require('./recordStore.cjs').updateSavedRecordPinState({
          fs,
          path,
          settings,
          recordId,
          bounds,
        })
      : Promise.resolve(null)
}

// 这条分支重新接回自定义截图和真实钉住，让主流程拿到真实选区坐标。
function runCaptureTranslationPin() {
  const settings = getPluginSettings()
  const credentials = readTranslationCredentials()
  const persistRecordPinState = createPersistPinnedRecordBounds(settings)

  return runMainWorkflow({
    settings,
    captureImage: async () =>
      captureImageWithCustomOverlay({
        utools: window.utools,
      }),
    translateImage: async (captureResult) =>
      translateCapturedImage({
        captureResult,
        settings,
        credentials,
      }),
    pinImage: async (translationResult, captureResult) =>
      pinTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult?.translatedImageDataUrl,
        bounds: captureResult?.bounds,
        persistRecordPinState,
      }),
    saveImage: async (translationResult, pinResult) => {
      const savedRecordResult = await require('./recordStore.cjs').saveTranslatedRecord({
        fs,
        path,
        settings,
        translationResult,
        bounds: pinResult?.bounds,
      })

      if (!savedRecordResult?.record?.id) {
        return { ok: false, code: 'save-failed' }
      }

      return attachPinnedRecord({
        windowId: pinResult?.windowId,
        recordId: savedRecordResult.record.id,
        persistRecordPinState,
      })
    },
  })
}

// preload 只暴露当前截图翻译插件正式保留的本地设置接口。
window.services = {
  ...(window.services || {}),
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
  getTranslationCredentials: readTranslationCredentials,
  saveTranslationCredentials: writeTranslationCredentials,
  // 目录选择只负责把系统选择器结果收口成单个目录字符串，取消时返回空串。
  pickSaveDirectory: async () => {
    if (!window.utools || typeof window.utools.showOpenDialog !== 'function') {
      return ''
    }

    const result = await window.utools.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (Array.isArray(result)) {
      return typeof result[0] === 'string' ? result[0] : ''
    }

    if (result && typeof result === 'object' && Array.isArray(result.filePaths)) {
      return typeof result.filePaths[0] === 'string' ? result.filePaths[0] : ''
    }

    return typeof result === 'string' ? result : ''
  },
  listSavedRecords: () => listSavedRecords({ fs, path, settings: getPluginSettings() }),
  deleteSavedRecord: (recordId) => deleteSavedRecord({ fs, path, settings: getPluginSettings(), recordId }),
  // 记录页重钉走真实记录读取和真实钉住窗口，已钉住时由 pin manager 负责拦截。
  repinSavedRecord: async (recordId) => {
    const settings = getPluginSettings()
    const persistRecordPinState = createPersistPinnedRecordBounds(settings)
    const record = await require('./recordStore.cjs').getSavedRecord({
      fs,
      path,
      settings,
      recordId,
    })

    if (!record) {
      return { ok: false, code: 'repin-failed' }
    }

    return repinSavedRecordImage({
      utools: window.utools,
      record,
      imageSrc: toFileUrl(path.resolve(settings.saveDirectory, record.imageFilename)),
      persistRecordPinState,
    })
  },
  runCaptureTranslationPin,
}
