const {
  normalizeUiSettings,
  normalizePluginSettings,
  mergePluginSettings,
} = require('./localState.cjs')
const { listSavedRecords, deleteSavedRecord } = require('./recordStore.cjs')
const { runMainWorkflow } = require('./workflow.cjs')
const { translateCapturedImage, getLastTranslationDebug } = require('./baiduPictureTranslate.cjs')
const {
  getTranslationCredentials,
  saveTranslationCredentials,
} = require('./translationCredentialStore.cjs')
const {
  pinTranslatedImage,
  attachPinnedRecord,
  repinSavedRecordImage,
} = require('./pinWindowManager.cjs')
const { buildImageDataUrlFromBuffer } = require('./imageMime.cjs')
const fs = require('fs')
const path = require('path')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'
const RUN_FEATURE_CODE = 'screen-shot-translation-run'
const WORKFLOW_RESULT_EVENT = 'screen-shot-translation:workflow-result'

let pendingPluginEnter = null
let pendingWorkflowResult = null
let runningPreloadWorkflow = false

function loadElectronModule(explicitElectron) {
  if (explicitElectron && typeof explicitElectron === 'object') {
    return explicitElectron
  }

  try {
    return require('electron')
  } catch {
    return null
  }
}

// 外链统一交给系统浏览器打开，避免在 uTools 容器里把普通超链接当成不可用的 webview 导航。
async function openExternalLink(url, runtime = {}) {
  const normalizedUrl = typeof url === 'string' ? url.trim() : ''
  const electronShell = loadElectronModule(runtime.electron)?.shell

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false
  }

  if (typeof electronShell?.openExternal === 'function') {
    try {
      return await electronShell.openExternal(normalizedUrl)
    } catch {
      return false
    }
  }

  return false
}

// run 入口需要在 preload 阶段就先把主窗口收起，避免页面壳子先露出来挡住截图区域。
function concealPluginWindow(runtime = window.utools) {
  const windowType = typeof runtime?.getWindowType === 'function' ? runtime.getWindowType() : 'main'

  if (windowType === 'detach' && typeof runtime?.outPlugin === 'function') {
    runtime.outPlugin()
    return
  }

  if (typeof runtime?.hideMainWindow === 'function') {
    runtime.hideMainWindow()
  }
}

// 成功钉住后更稳的收尾是直接退出插件主窗口，让钉住窗体单独留在桌面上。
function dismissPluginWindowAfterSuccess(runtime = window.utools) {
  if (typeof runtime?.outPlugin === 'function') {
    runtime.outPlugin()
    return
  }

  if (typeof runtime?.hideMainWindow === 'function') {
    runtime.hideMainWindow()
  }
}

// run 入口默认隐藏主窗口，失败时由 preload 直接恢复可见性，避免只依赖渲染层时序。
function revealPluginWindow(runtime = window.utools) {
  if (typeof runtime?.showMainWindow !== 'function') {
    return
  }

  try {
    runtime.showMainWindow()
  } catch {
    // 恢复失败时继续静默兜底，不把窗口状态问题扩大成新的异常。
  }
}

function handlePreloadPluginEnter(event = {}) {
  pendingPluginEnter = event && typeof event === 'object' ? event : {}

  if (pendingPluginEnter.code !== RUN_FEATURE_CODE) {
    return
  }

  if (runningPreloadWorkflow) {
    return
  }

  pendingWorkflowResult = null
  runningPreloadWorkflow = true

  Promise.resolve(runCaptureTranslationPin())
    .then((result) => {
      if (result && result.ok === false) {
        pendingWorkflowResult = result
        emitWorkflowResult(result)
      }
    })
    .finally(() => {
      runningPreloadWorkflow = false
    })
}

// 渲染层挂载后会主动消费一次 preload 缓存的进入事件，避免首个 run 入口时序丢失。
function consumePendingPluginEnter() {
  const nextEvent = pendingPluginEnter
  pendingPluginEnter = null
  return nextEvent
}

// run 入口失败时，渲染层要能直接消费 preload 已经拿到的失败结果。
function consumePendingWorkflowResult() {
  const nextResult = pendingWorkflowResult
  pendingWorkflowResult = null
  return nextResult
}

// preload 触发截图后，如果失败态需要结果页承载，就用自定义事件把结果同步给已挂载的渲染层。
function emitWorkflowResult(result) {
  if (typeof window?.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return
  }

  try {
    window.dispatchEvent(new CustomEvent(WORKFLOW_RESULT_EVENT, { detail: result }))
  } catch {
    // 事件广播只是加速渲染层拿到失败结果，失败时继续保留 pending 缓存兜底。
  }
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
  return getTranslationCredentials(window.utools?.db)
}

// 设置页写凭证时也走同一份同步文档，便于多设备跟着 uTools 账号同步。
function writeTranslationCredentials(partial) {
  return saveTranslationCredentials(window.utools?.db, partial)
}

// 打开保存目录优先走 Electron shell，确保这条路径不被 uTools 包装层行为差异卡住。
async function openSaveDirectory(runtime = {}) {
  const directoryPath = getPluginSettings().saveDirectory
  const utools = runtime.utools ?? window.utools
  const electronShell = loadElectronModule(runtime.electron)?.shell

  if (!directoryPath) {
    return false
  }

  // Electron 的 openPath 会直接交给系统打开目录，成功时返回空字符串。
  if (typeof electronShell?.openPath === 'function') {
    try {
      const errorMessage = await electronShell.openPath(directoryPath)

      if (!errorMessage) {
        return true
      }
    } catch {
      // 这里先继续降级，不把单一路径失败直接暴露成用户可见错误。
    }
  }

  // 有些系统上 reveal 比 open 更稳，这里作为 Electron 层的第二优先级。
  if (typeof electronShell?.showItemInFolder === 'function') {
    try {
      electronShell.showItemInFolder(directoryPath)
      return true
    } catch {
      // 继续回退到 uTools wrapper，保持目录打开链路尽量可用。
    }
  }

  // 兜底继续保留 uTools 自带系统 API，覆盖没有 Electron shell 的环境。
  if (typeof utools?.shellOpenPath === 'function') {
    try {
      utools.shellOpenPath(directoryPath)
      return true
    } catch {
      // 继续尝试 reveal 兜底。
    }
  }

  if (typeof utools?.shellShowItemInFolder === 'function') {
    try {
      utools.shellShowItemInFolder(directoryPath)
      return true
    } catch {
      // 最后一层兜底失败后再统一给提示。
    }
  }

  try {
    utools?.showNotification?.('打开保存目录失败，请检查目录路径是否有效。')
  } catch {
    // 通知本身只是辅助诊断，不需要再继续抛错。
  }

  return false
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

// 记录页重钉优先把本地图片转成 data url，再交给 pin window 做透明白底处理。
// 这样可以避开 file:// 图片在子窗口 canvas 里读像素时可能直接失败的问题。
async function readImageAsDataUrl(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return ''
  }

  try {
    const imageBuffer = await fs.promises.readFile(filePath)
    return buildImageDataUrlFromBuffer(imageBuffer)
  } catch {
    return ''
  }
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

// 主流程改回官方 screenCapture，只收口成图片结果，不再把自定义选区坐标带进主路径。
function captureImageViaOfficialApi(runtime = window.utools) {
  return new Promise((resolve) => {
    if (!runtime || typeof runtime.screenCapture !== 'function') {
      resolve({ ok: false, code: 'capture-cancelled' })
      return
    }

    try {
      runtime.screenCapture((image) => {
        const normalizedImage = typeof image === 'string' ? image.trim() : ''

        if (!normalizedImage.startsWith('data:image/')) {
          resolve({ ok: false, code: 'capture-cancelled' })
          return
        }

        resolve({
          ok: true,
          image: normalizedImage,
        })
      })
    } catch {
      resolve({ ok: false, code: 'capture-cancelled' })
    }
  })
}

// 主流程只保留截图、翻译、钉图、保存四步；截图统一改回官方 screenCapture。
function runCaptureTranslationPin() {
  const settings = getPluginSettings()
  const credentials = readTranslationCredentials()
  const persistRecordPinState = createPersistPinnedRecordBounds(settings)

  return runMainWorkflow({
    settings,
    captureImage: async () => captureImageViaOfficialApi(window.utools),
    translateImage: async (captureResult) =>
      translateCapturedImage({
        captureResult,
        settings,
        credentials,
      }),
    pinImage: async (translationResult) =>
      pinTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult?.translatedImageDataUrl,
        bounds: null,
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
  }).then((result) => {
    if (result && result.ok === true) {
      dismissPluginWindowAfterSuccess(window.utools)
    }

    if (result && result.ok === false && result.code === 'translation-failed') {
      revealPluginWindow(window.utools)
      return {
        ...result,
        translationDebug: getLastTranslationDebug(),
      }
    }

    if (result && result.ok === false) {
      revealPluginWindow(window.utools)
    }

    return result
  })
}

// preload 只暴露当前截图翻译插件正式保留的本地设置接口。
if (typeof window.utools?.onPluginEnter === 'function') {
  window.utools.onPluginEnter(handlePreloadPluginEnter)
}

window.services = {
  ...(window.services || {}),
  concealPluginWindow,
  consumePendingPluginEnter,
  consumePendingWorkflowResult,
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
  getTranslationCredentials: readTranslationCredentials,
  saveTranslationCredentials: writeTranslationCredentials,
  getLastTranslationDebug,
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
  openSaveDirectory,
  openExternalLink,
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

    const imagePath = path.resolve(settings.saveDirectory, record.imageFilename)
    const inlineImageSrc = await readImageAsDataUrl(imagePath)

    return repinSavedRecordImage({
      utools: window.utools,
      record,
      imageSrc: inlineImageSrc || toFileUrl(imagePath),
      persistRecordPinState,
    })
  },
  runCaptureTranslationPin,
}
