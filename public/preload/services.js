const {
  normalizeUiSettings,
  normalizePluginSettings,
  mergePluginSettings,
} = require('./localState.cjs')
const fs = require('fs')
const path = require('path')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'
const moduleCache = {}
const moduleLoadErrors = {}

function safeRequire(moduleKey, relativePath) {
  if (Object.prototype.hasOwnProperty.call(moduleCache, moduleKey)) {
    return moduleCache[moduleKey]
  }

  try {
    const loadedModule = require(relativePath)
    if (!loadedModule || typeof loadedModule !== 'object') {
      throw new Error(`${moduleKey} did not export an object`)
    }

    moduleCache[moduleKey] = loadedModule
    delete moduleLoadErrors[moduleKey]
    return loadedModule
  } catch (error) {
    moduleCache[moduleKey] = null
    moduleLoadErrors[moduleKey] = error

    try {
      console.error(`[screen-shot-translation] failed to load ${moduleKey}`)
      console.error(error)
    } catch {
      // preload 诊断写日志失败时保持静默，避免次生错误继续放大。
    }

    return null
  }
}

// preload 启动时只保留本页立刻需要的轻模块，复杂桥接延迟到对应动作真正触发时再加载。
function getRecordStoreModule() {
  return safeRequire('recordStore', './recordStore.cjs')
}

function getWorkflowModule() {
  return safeRequire('workflow', './workflow.cjs')
}

function getBaiduPictureTranslateModule() {
  return safeRequire('baiduPictureTranslate', './baiduPictureTranslate.cjs')
}

function getTranslationCredentialStoreModule() {
  return safeRequire('translationCredentialStore', './translationCredentialStore.cjs')
}

function getCustomCaptureModule() {
  return safeRequire('customCapture', './customCapture.cjs')
}

function getPinWindowManagerModule() {
  return safeRequire('pinWindowManager', './pinWindowManager.cjs')
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
  const credentialStore = getTranslationCredentialStoreModule()
  if (!credentialStore || typeof credentialStore.getTranslationCredentials !== 'function') {
    return {
      appId: '',
      appKey: '',
    }
  }

  return credentialStore.getTranslationCredentials(window.utools?.db)
}

// 设置页写凭证时也走同一份同步文档，便于多设备跟着 uTools 账号同步。
function writeTranslationCredentials(partial) {
  const credentialStore = getTranslationCredentialStoreModule()
  if (!credentialStore || typeof credentialStore.saveTranslationCredentials !== 'function') {
    return {
      ...readTranslationCredentials(),
      ...(partial && typeof partial === 'object' ? partial : {}),
    }
  }

  return credentialStore.saveTranslationCredentials(window.utools?.db, partial)
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

function createPersistPinnedRecordBounds(settings) {
  const recordStore = getRecordStoreModule()

  return (recordId, bounds) =>
    typeof recordStore?.updateSavedRecordPinState === 'function'
      ? recordStore.updateSavedRecordPinState({
          fs,
          path,
          settings,
          recordId,
          bounds,
        })
      : Promise.resolve(null)
}

// 子窗口资源在开发态需要显式指向当前 Vite 地址，否则 createBrowserWindow 只拿到相对路径会出现白屏。
function resolveBrowserWindowAssetUrl(assetPath) {
  const normalizedAssetPath = String(assetPath || '').replace(/^[/\\]+/, '')
  const runtime = window.utools
  const currentOrigin =
    typeof window.location?.origin === 'string' ? window.location.origin.replace(/\/+$/, '') : ''

  if (runtime?.isDev?.() && /^https?:\/\//.test(currentOrigin) && normalizedAssetPath) {
    return `${currentOrigin}/${normalizedAssetPath}`
  }

  return normalizedAssetPath
}

// 主流程现在接的是自定义截图、真实翻译、真实钉住和可选保存，不再依赖模板占位。
function runCaptureTranslationPin() {
  const workflowModule = getWorkflowModule()
  const customCaptureModule = getCustomCaptureModule()
  const baiduPictureTranslateModule = getBaiduPictureTranslateModule()
  const pinWindowManagerModule = getPinWindowManagerModule()

  if (
    !workflowModule ||
    typeof workflowModule.runMainWorkflow !== 'function' ||
    !customCaptureModule ||
    typeof customCaptureModule.captureImageWithCustomOverlay !== 'function' ||
    !baiduPictureTranslateModule ||
    typeof baiduPictureTranslateModule.translateCapturedImage !== 'function' ||
    !pinWindowManagerModule ||
    typeof pinWindowManagerModule.pinTranslatedImage !== 'function'
  ) {
    return Promise.resolve({ ok: false, code: 'translation-failed' })
  }

  const settings = getPluginSettings()
  const credentials = readTranslationCredentials()
  const persistRecordPinState = createPersistPinnedRecordBounds(settings)

  return workflowModule.runMainWorkflow({
    settings,
    captureImage: async () =>
      customCaptureModule.captureImageWithCustomOverlay({
        utools: window.utools,
        resolveAssetUrl: resolveBrowserWindowAssetUrl,
      }),
    translateImage: async (captureResult) =>
      baiduPictureTranslateModule.translateCapturedImage({
        captureResult,
        settings,
        credentials,
      }),
    pinImage: async (translationResult, captureResult) =>
      pinWindowManagerModule.pinTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult?.translatedImageDataUrl,
        bounds: captureResult?.bounds,
        persistRecordPinState,
        resolveAssetUrl: resolveBrowserWindowAssetUrl,
      }),
    saveImage: async (translationResult, pinResult) => {
      const recordStoreModule = getRecordStoreModule()
      if (!recordStoreModule || typeof recordStoreModule.saveTranslatedRecord !== 'function') {
        return { ok: false, code: 'save-failed' }
      }

      const savedRecordResult = await recordStoreModule.saveTranslatedRecord({
        fs,
        path,
        settings,
        translationResult,
        bounds: pinResult?.bounds,
      })

      if (!savedRecordResult?.record?.id) {
        return { ok: false, code: 'save-failed' }
      }

      if (typeof pinWindowManagerModule.attachPinnedRecord !== 'function') {
        return { ok: false, code: 'save-failed' }
      }

      const attachResult = await pinWindowManagerModule.attachPinnedRecord({
        windowId: pinResult?.windowId,
        recordId: savedRecordResult.record.id,
        persistRecordPinState,
      })

      if (!attachResult?.ok) {
        return { ok: false, code: 'save-failed' }
      }

      return {
        ok: true,
        recordId: savedRecordResult.record.id,
      }
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
  getPreloadDiagnostics: () =>
    Object.entries(moduleLoadErrors).map(([moduleKey, error]) => ({
      moduleKey,
      message: error && typeof error.message === 'string' ? error.message : String(error || 'unknown error'),
    })),
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
  listSavedRecords: () => {
    const recordStore = getRecordStoreModule()
    if (!recordStore || typeof recordStore.listSavedRecords !== 'function') {
      return Promise.resolve({ records: [] })
    }

    return recordStore.listSavedRecords({ fs, path, settings: getPluginSettings() })
  },
  deleteSavedRecord: (recordId) => {
    const recordStore = getRecordStoreModule()
    if (!recordStore || typeof recordStore.deleteSavedRecord !== 'function') {
      return Promise.resolve({ records: [] })
    }

    return recordStore.deleteSavedRecord({ fs, path, settings: getPluginSettings(), recordId })
  },
  repinSavedRecord: async (recordId) => {
    const recordStore = getRecordStoreModule()
    const pinWindowManager = getPinWindowManagerModule()
    if (
      !recordStore ||
      typeof recordStore.getSavedRecord !== 'function' ||
      !pinWindowManager ||
      typeof pinWindowManager.repinSavedRecordImage !== 'function'
    ) {
      return { ok: false, code: 'repin-failed' }
    }

    const settings = getPluginSettings()
    const persistRecordPinState = createPersistPinnedRecordBounds(settings)
    const record = await recordStore.getSavedRecord({
      fs,
      path,
      settings,
      recordId,
    })

    if (!record) {
      return { ok: false, code: 'repin-failed' }
    }

    const absoluteImagePath = path.resolve(settings.saveDirectory, record.imageFilename)

    return pinWindowManager.repinSavedRecordImage({
      utools: window.utools,
      record,
      imageSrc: toFileUrl(absoluteImagePath),
      persistRecordPinState,
      resolveAssetUrl: resolveBrowserWindowAssetUrl,
    })
  },
  runCaptureTranslationPin,
}
