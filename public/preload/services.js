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
  pegTranslatedImage,
  attachPeggedRecord,
  repegSavedRecordImage,
} = require('./pegImageWindowManager.cjs')
const { buildImageDataUrlFromBuffer } = require('./imageMime.cjs')
const fs = require('fs')
const path = require('path')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'
const RUN_FEATURE_CODE = 'screen-shot-translation-peg-run'
const RECORDS_FEATURE_CODE = 'screen-shot-translation-peg-records'
const SETTINGS_FEATURE_CODE = 'screen-shot-translation-settings'
const PANEL_INIT_EVENT = 'screen-shot-translation:panel-init'

let runningPreloadWorkflow = false
let panelWindow = null

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

// 成功钉图后更稳的收尾是直接退出插件主窗口，让钉图窗体单独留在桌面上。
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

const PANEL_HTML_PATH = 'panel.html'

// 模板插件模式下不能再依赖 plugin main 壳，所以 records/settings/result 都改成显式打开自定义面板窗口。
function normalizePanelView(view) {
  switch (view) {
    case 'settings':
      return 'settings'
    case 'result':
      return 'result'
    case 'records':
    default:
      return 'records'
  }
}

function isUsablePanelWindow(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return false
  }

  if (typeof candidate.isDestroyed === 'function') {
    try {
      return candidate.isDestroyed() === false
    } catch {
      return false
    }
  }

  return true
}

function clearPanelWindow(candidate) {
  if (candidate && candidate === panelWindow) {
    panelWindow = null
  }
}

// records/settings/result 面板窗口只应服务于面板视图；run 主流程开始前必须先把它关掉，避免被截进截图里。
function dismissPanelWindow() {
  const candidate = panelWindow
  panelWindow = null

  if (!isUsablePanelWindow(candidate)) {
    return false
  }

  try {
    candidate.hide?.()
  } catch {
    // 关闭前先隐藏只是锦上添花，失败时继续尝试彻底关闭窗口。
  }

  try {
    candidate.close?.()
  } catch {
    // 某些 BrowserWindow mock 可能没有 close，继续回退 destroy。
  }

  try {
    candidate.destroy?.()
  } catch {
    // 没有 destroy 或销毁失败时不再扩大异常，窗口引用已被清理。
  }

  return true
}

function attachPanelWindowLifecycle(candidate) {
  if (!isUsablePanelWindow(candidate) || typeof candidate.on !== 'function') {
    return
  }

  try {
    candidate.on('closed', () => clearPanelWindow(candidate))
    candidate.on('close', () => clearPanelWindow(candidate))
  } catch {
    // BrowserWindow 生命周期监听只是为了清理引用，失败时不影响主路径。
  }
}

function sendPanelInitPayload(targetWindow, payload) {
  if (!isUsablePanelWindow(targetWindow)) {
    return false
  }

  const normalizedPayload = payload && typeof payload === 'object' ? payload : {}

  try {
    if (typeof targetWindow.webContents?.send === 'function') {
      targetWindow.webContents.send(PANEL_INIT_EVENT, normalizedPayload)
      return true
    }
  } catch {
    // 继续回退到 executeJavaScript，避免部分环境里 webContents.send 不可用。
  }

  try {
    if (typeof targetWindow.webContents?.executeJavaScript === 'function') {
      const serializedPayload = JSON.stringify(normalizedPayload)
      targetWindow.webContents.executeJavaScript(
        `window.__PANEL_INIT__ = ${serializedPayload}; window.dispatchEvent(new CustomEvent(${JSON.stringify(
          PANEL_INIT_EVENT,
        )}, { detail: window.__PANEL_INIT__ }));`,
      )
      return true
    }
  } catch {
    // 面板窗口没有拿到 init payload 时，页面仍可按 URL query 渲染默认视图。
  }

  return false
}

// records/settings/result 共用一个轻量面板窗口，避免 plugin main 页面壳再次参与运行链路。
function openPanelWindow({ view, result } = {}, runtime = window.utools) {
  if (!runtime || typeof runtime.createBrowserWindow !== 'function') {
    return false
  }

  const normalizedView = normalizePanelView(view)
  const payload = {
    view: normalizedView,
    result: result && typeof result === 'object' ? result : null,
  }

  if (isUsablePanelWindow(panelWindow)) {
    sendPanelInitPayload(panelWindow, payload)
    panelWindow.show?.()
    panelWindow.focus?.()
    return true
  }

  const nextWindow = runtime.createBrowserWindow(
    `${PANEL_HTML_PATH}?view=${encodeURIComponent(normalizedView)}`,
    {
      title: '截屏翻译钉图',
      width: 1120,
      height: getUiSettings().windowHeight,
      minWidth: 760,
      minHeight: 520,
      useContentSize: true,
      show: false,
      webPreferences: {
        preload: 'preload/panel-preload.js',
      },
    },
    (createdWindow) => {
      const targetWindow = createdWindow || nextWindow
      if (!isUsablePanelWindow(targetWindow)) {
        return
      }

      panelWindow = targetWindow
      attachPanelWindowLifecycle(targetWindow)
      sendPanelInitPayload(targetWindow, payload)
      targetWindow.show?.()
      targetWindow.focus?.()
    },
  )

  if (isUsablePanelWindow(nextWindow)) {
    panelWindow = nextWindow
    attachPanelWindowLifecycle(nextWindow)
  }

  return true
}

function openRecordsWindow(runtime = window.utools) {
  return openPanelWindow({ view: 'records' }, runtime)
}

function openSettingsWindow(runtime = window.utools) {
  return openPanelWindow({ view: 'settings' }, runtime)
}

function openResultWindow(result, runtime = window.utools) {
  return openPanelWindow({ view: 'result', result }, runtime)
}

// 截图主流程只允许在 preload 跑一个实例，避免 uTools 重复触发时叠加多个截图会话。
function startRunFeatureWorkflow() {
  dismissPanelWindow()

  if (runningPreloadWorkflow) {
    return
  }

  runningPreloadWorkflow = true

  Promise.resolve(runCaptureTranslationPin())
    .then(() => undefined)
    .finally(() => {
      runningPreloadWorkflow = false
    })
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

// 记录页重钉图优先把本地图片转成 data url，再交给 peg window 做透明白底处理。
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

// 钉图窗口拖动结束后，要把最后成功停留的位置写回记录清单。
function createPersistPeggedRecordBounds(settings) {
  return (recordId, bounds) =>
    typeof recordId === 'string' && recordId.trim()
      ? require('./recordStore.cjs').updateSavedRecordPegState({
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
      // 参考官方模板插件示例，截图前先收起当前插件窗口，避免插件自己的壳子被带进截图。
      if (typeof runtime.hideMainWindow === 'function') {
        runtime.hideMainWindow()
      }

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
  const persistRecordPegState = createPersistPeggedRecordBounds(settings)

  return runMainWorkflow({
    settings,
    captureImage: async () => captureImageViaOfficialApi(window.utools),
    translateImage: async (captureResult) =>
      translateCapturedImage({
        captureResult,
        settings,
        credentials,
      }),
    pegImage: async (translationResult) =>
      pegTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult?.translatedImageDataUrl,
        bounds: null,
        persistRecordPegState,
      }),
    saveImage: async (translationResult, pegResult) => {
      const savedRecordResult = await require('./recordStore.cjs').saveTranslatedRecord({
        fs,
        path,
        settings,
        translationResult,
        bounds: pegResult?.bounds,
      })

      if (!savedRecordResult?.record?.id) {
        return { ok: false, code: 'save-failed' }
      }

      return attachPeggedRecord({
        windowId: pegResult?.windowId,
        recordId: savedRecordResult.record.id,
        persistRecordPegState,
      })
    },
  }).then((result) => {
    if (result && result.ok === true) {
      dismissPluginWindowAfterSuccess(window.utools)
    }

    if (result && result.ok === false && result.code === 'translation-failed') {
      const failureResult = {
        ...result,
        translationDebug: getLastTranslationDebug(),
      }
      openResultWindow(failureResult, window.utools)
      return failureResult
    }

    if (result && result.ok === false) {
      openResultWindow(result, window.utools)
    }

    return result
  })
}

// 模板插件模式下，三个入口都通过 window.exports 收口，避免 plugin main 页面壳再次参与运行。
window.exports = {
  ...(window.exports || {}),
  [RUN_FEATURE_CODE]: {
    mode: 'none',
    args: {
      enter: () => {
        startRunFeatureWorkflow()
      },
    },
  },
  [RECORDS_FEATURE_CODE]: {
    mode: 'none',
    args: {
      enter: () => {
        openRecordsWindow(window.utools)
      },
    },
  },
  [SETTINGS_FEATURE_CODE]: {
    mode: 'none',
    args: {
      enter: () => {
        openSettingsWindow(window.utools)
      },
    },
  },
}

window.services = {
  ...(window.services || {}),
  concealPluginWindow,
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
  getTranslationCredentials: readTranslationCredentials,
  saveTranslationCredentials: writeTranslationCredentials,
  getLastTranslationDebug,
  openRecordsWindow,
  openSettingsWindow,
  openResultWindow,
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
  // 记录页重钉图走真实记录读取和真实钉图窗口，已钉图时由 peg manager 负责拦截。
  repegSavedRecord: async (recordId) => {
    const settings = getPluginSettings()
    const persistRecordPegState = createPersistPeggedRecordBounds(settings)
    const record = await require('./recordStore.cjs').getSavedRecord({
      fs,
      path,
      settings,
      recordId,
    })

    if (!record) {
      return { ok: false, code: 'repeg-failed' }
    }

    const imagePath = path.resolve(settings.saveDirectory, record.imageFilename)
    const inlineImageSrc = await readImageAsDataUrl(imagePath)

    return repegSavedRecordImage({
      utools: window.utools,
      record,
      imageSrc: inlineImageSrc || toFileUrl(imagePath),
      persistRecordPegState,
    })
  },
  runCaptureTranslationPin,
}
