const activePinWindowsById = new Map()
const activePinWindowIdByRecordId = new Map()

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

function normalizePinBounds(bounds) {
  const candidate = bounds && typeof bounds === 'object' ? bounds : {}
  const x = Math.round(Number(candidate.x))
  const y = Math.round(Number(candidate.y))
  const width = Math.round(Number(candidate.width))
  const height = Math.round(Number(candidate.height))

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

function closeWindow(windowInstance) {
  if (!windowInstance || typeof windowInstance.close !== 'function') {
    return
  }

  try {
    if (!windowInstance.isDestroyed || !windowInstance.isDestroyed()) {
      windowInstance.close()
    }
  } catch {
    // 双击关闭只是用户交互收尾，不需要把清理失败继续往上抛。
  }
}

function getActiveEntryByRecordId(recordId) {
  const windowId = activePinWindowIdByRecordId.get(recordId)
  if (!windowId) {
    return null
  }

  const entry = activePinWindowsById.get(windowId)
  if (!entry) {
    activePinWindowIdByRecordId.delete(recordId)
    return null
  }

  if (entry.windowInstance?.isDestroyed?.()) {
    activePinWindowsById.delete(windowId)
    activePinWindowIdByRecordId.delete(recordId)
    return null
  }

  return entry
}

async function persistEntryBounds(entry, explicitBounds) {
  if (!entry || !entry.recordId || typeof entry.persistRecordPinState !== 'function') {
    return
  }

  const bounds = normalizePinBounds(explicitBounds || entry.bounds)
  if (!bounds) {
    return
  }

  await entry.persistRecordPinState(entry.recordId, bounds)
  entry.bounds = bounds
}

function cleanupEntry(entry, ipcRenderer) {
  if (!entry) {
    return
  }

  activePinWindowsById.delete(entry.windowId)
  if (entry.recordId) {
    activePinWindowIdByRecordId.delete(entry.recordId)
  }
  if (entry.channel && ipcRenderer?.off && entry.handleMessage) {
    ipcRenderer.off(entry.channel, entry.handleMessage)
  }
}

function buildPinWindowEntry({
  windowInstance,
  windowId,
  channel,
  initialBounds,
  ipcRenderer,
  persistRecordPinState,
}) {
  const entry = {
    windowInstance,
    windowId,
    channel,
    ipcRenderer,
    recordId: '',
    bounds: normalizePinBounds(initialBounds),
    dragState: null,
    persistRecordPinState,
    handleMessage: null,
  }

  entry.handleMessage = async (_event, payload = {}) => {
    if (!payload || typeof payload !== 'object') {
      return
    }

    if (payload.type === 'drag-start') {
      entry.dragState = {
        screenX: Number(payload.screenX),
        screenY: Number(payload.screenY),
        bounds: { ...entry.bounds },
      }
      return
    }

    if ((payload.type === 'dragging' || payload.type === 'drag-end') && entry.dragState) {
      const currentScreenX = Number(payload.screenX)
      const currentScreenY = Number(payload.screenY)

      if (!Number.isFinite(currentScreenX) || !Number.isFinite(currentScreenY)) {
        return
      }

      const nextBounds = normalizePinBounds({
        x: entry.dragState.bounds.x + (currentScreenX - entry.dragState.screenX),
        y: entry.dragState.bounds.y + (currentScreenY - entry.dragState.screenY),
        width: entry.dragState.bounds.width,
        height: entry.dragState.bounds.height,
      })

      if (!nextBounds) {
        return
      }

      entry.bounds = nextBounds
      try {
        entry.windowInstance?.setPosition?.(nextBounds.x, nextBounds.y)
      } catch {
        // 拖动时窗口如果已经销毁，这次消息直接丢弃即可。
      }

      if (payload.type === 'drag-end') {
        entry.dragState = null
        await persistEntryBounds(entry, nextBounds)
      }
      return
    }

    if (payload.type === 'close') {
      await persistEntryBounds(entry)
      closeWindow(entry.windowInstance)
      cleanupEntry(entry, ipcRenderer)
    }
  }

  ipcRenderer.on(channel, entry.handleMessage)
  activePinWindowsById.set(windowId, entry)
  return entry
}

function openPinWindow({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
  imageSrc,
  bounds,
  persistRecordPinState,
}) {
  const runtime = utools && typeof utools === 'object' ? utools : null
  const ipcRenderer = loadElectronModule(electron)?.ipcRenderer
  const normalizedBounds = normalizePinBounds(bounds)
  const normalizedImageSrc = typeof imageSrc === 'string' ? imageSrc.trim() : ''

  if (
    !runtime ||
    typeof runtime.createBrowserWindow !== 'function' ||
    !ipcRenderer ||
    typeof ipcRenderer.on !== 'function' ||
    typeof ipcRenderer.off !== 'function' ||
    !normalizedBounds ||
    !normalizedImageSrc
  ) {
    return Promise.resolve({ ok: false, code: 'pin-failed' })
  }

  return new Promise((resolve) => {
    let pinWindow = null
    let channel = ''

    pinWindow = runtime.createBrowserWindow(
      resolveAssetUrl('pin-window.html'),
      {
        x: normalizedBounds.x,
        y: normalizedBounds.y,
        width: normalizedBounds.width,
        height: normalizedBounds.height,
        frame: false,
        resizable: false,
        movable: false,
        closable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        transparent: true,
        show: true,
        webPreferences: {
          zoomFactor: 1,
          nodeIntegration: true,
          contextIsolation: false,
          devTools: true,
        },
      },
      async () => {
        try {
          await pinWindow.webContents.executeJavaScript(
            `window.__SCREEN_TRANSLATION_PIN_INIT__(${JSON.stringify({
              channel,
              imageSrc: normalizedImageSrc,
            })})`,
            true,
          )
        } catch {
          cleanupEntry(activePinWindowsById.get(pinWindow?.id), ipcRenderer)
          closeWindow(pinWindow)
          resolve({ ok: false, code: 'pin-failed' })
        }
      },
    )

    if (!pinWindow || typeof pinWindow.id !== 'number') {
      resolve({ ok: false, code: 'pin-failed' })
      return
    }

    channel = `screen-translation:pin:${pinWindow.id}`
    buildPinWindowEntry({
      windowInstance: pinWindow,
      windowId: pinWindow.id,
      channel,
      initialBounds: normalizedBounds,
      ipcRenderer,
      persistRecordPinState,
    })

    resolve({
      ok: true,
      windowId: pinWindow.id,
      bounds: normalizedBounds,
    })
  })
}

// 主流程 pin 成功后，保存记录才会生成 recordId，这一步把活动窗口补上正式关联关系。
async function attachPinnedRecord({
  windowId,
  recordId,
  persistRecordPinState,
}) {
  const entry = activePinWindowsById.get(windowId)
  if (!entry || !recordId) {
    return { ok: false, code: 'pin-failed' }
  }

  entry.recordId = recordId
  entry.persistRecordPinState = persistRecordPinState
  activePinWindowIdByRecordId.set(recordId, windowId)
  await persistEntryBounds(entry)

  return { ok: true, windowId, recordId }
}

// 记录页重钉前先查活动窗口，避免同一张图被重复创建多个钉住实例。
async function repinSavedRecordImage({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
  record,
  imageSrc,
  persistRecordPinState,
}) {
  if (!record || typeof record.id !== 'string') {
    return { ok: false, code: 'repin-failed' }
  }

  const activeEntry = getActiveEntryByRecordId(record.id)
  if (activeEntry) {
    try {
      activeEntry.windowInstance?.setAlwaysOnTop?.(true)
      activeEntry.windowInstance?.moveTop?.()
    } catch {
      // 已钉住提示只影响体验，不阻塞主流程。
    }

    try {
      utools?.showNotification?.('该图片已经钉住，不能重复钉住。')
    } catch {
      // 通知失败时也保持 no-op，避免把友好提示升级成错误页。
    }

    return { ok: true, code: 'already-pinned' }
  }

  const result = await openPinWindow({
    utools,
    electron,
    resolveAssetUrl,
    imageSrc,
    bounds: record.lastPinBounds,
    persistRecordPinState,
  })

  if (!result.ok) {
    return { ok: false, code: 'repin-failed' }
  }

  await attachPinnedRecord({
    windowId: result.windowId,
    recordId: record.id,
    persistRecordPinState,
  })

  return result
}

module.exports = {
  pinTranslatedImage: openPinWindow,
  attachPinnedRecord,
  repinSavedRecordImage,
}
