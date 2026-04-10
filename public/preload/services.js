const {
  normalizeUiSettings,
  normalizePluginSettings,
  mergePluginSettings,
} = require('./localState.cjs')
const { listSavedRecords, deleteSavedRecord } = require('./recordStore.cjs')
const { runMainWorkflow } = require('./workflow.cjs')
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

// 目前还没有真实 capture / translate / pin / save 实现，这里先挂一层可测试的占位编排。
function runCaptureTranslationPin() {
  return runMainWorkflow({
    settings: getPluginSettings(),
    captureImage: async () => ({ ok: false, code: 'cancelled' }),
    translateImage: async () => ({ ok: false, code: 'not-implemented' }),
    pinImage: async () => ({ ok: false, code: 'not-implemented' }),
    saveImage: async () => ({ ok: false, code: 'not-implemented' }),
  })
}

// preload 只暴露当前截图翻译插件正式保留的本地设置接口。
window.services = {
  ...(window.services || {}),
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
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
  // 当前版本没有真实重钉能力时，桥接层只返回一个诚实失败给前端闭环。
  repinSavedRecord: async (recordId) => {
    void recordId
    return { ok: false, code: 'repin-failed' }
  },
  runCaptureTranslationPin,
}
