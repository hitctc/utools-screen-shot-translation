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

function normalizeDisplay(display) {
  const candidate = display && typeof display === 'object' ? display : {}
  const bounds = candidate.bounds && typeof candidate.bounds === 'object' ? candidate.bounds : null
  const x = Math.round(Number(bounds?.x))
  const y = Math.round(Number(bounds?.y))
  const width = Math.round(Number(bounds?.width))
  const height = Math.round(Number(bounds?.height))
  const scaleFactor = Number(candidate.scaleFactor)

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null
  }

  return {
    id: candidate.id,
    scaleFactor: Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1,
    bounds: { x, y, width, height },
  }
}

function normalizeCaptureBounds(bounds) {
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
    // 关闭窗口失败时，这里只做静默兜底，避免把取消截图再次放大成新的异常。
  }
}

// 自定义截图只负责拉起全屏选区并把图片与原始坐标带回主流程，不处理翻译和钉住。
function captureImageWithCustomOverlay({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
} = {}) {
  const runtime = utools && typeof utools === 'object' ? utools : null
  const ipcRenderer = loadElectronModule(electron)?.ipcRenderer

  if (
    !runtime ||
    typeof runtime.createBrowserWindow !== 'function' ||
    typeof runtime.getCursorScreenPoint !== 'function' ||
    typeof runtime.getDisplayNearestPoint !== 'function' ||
    !ipcRenderer ||
    typeof ipcRenderer.on !== 'function' ||
    typeof ipcRenderer.off !== 'function'
  ) {
    return Promise.resolve({ ok: false, code: 'capture-cancelled' })
  }

  const display = normalizeDisplay(runtime.getDisplayNearestPoint(runtime.getCursorScreenPoint()))
  if (!display) {
    return Promise.resolve({ ok: false, code: 'capture-cancelled' })
  }

  return new Promise((resolve) => {
    let captureWindow = null
    let didHideMainWindow = false
    let finished = false
    let channel = ''

    const finish = (result) => {
      if (finished) {
        return
      }

      finished = true
      if (channel) {
        ipcRenderer.off(channel, handleMessage)
      }
      closeWindow(captureWindow)

      if (didHideMainWindow && typeof runtime.showMainWindow === 'function') {
        try {
          runtime.showMainWindow()
        } catch {
          // 结果页是否显示由主窗口继续决定，这里不再额外抛错。
        }
      }

      resolve(result)
    }

    const handleMessage = (_event, payload = {}) => {
      if (!payload || typeof payload !== 'object') {
        finish({ ok: false, code: 'capture-cancelled' })
        return
      }

      if (payload.type === 'submit') {
        const bounds = normalizeCaptureBounds(payload.bounds)
        const image = typeof payload.image === 'string' ? payload.image.trim() : ''

        if (!bounds || !image) {
          finish({ ok: false, code: 'capture-cancelled' })
          return
        }

        finish({
          ok: true,
          image,
          bounds,
        })
        return
      }

      finish({ ok: false, code: 'capture-cancelled' })
    }

    if (typeof runtime.hideMainWindow === 'function') {
      try {
        didHideMainWindow = !!runtime.hideMainWindow()
      } catch {
        didHideMainWindow = false
      }
    }

    captureWindow = runtime.createBrowserWindow(
      resolveAssetUrl('capture-overlay.html'),
      {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        resizable: false,
        movable: false,
        closable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        transparent: false,
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
          await captureWindow.webContents.executeJavaScript(
            `window.__SCREEN_TRANSLATION_CAPTURE_INIT__(${JSON.stringify({
              channel,
              displayId: display.id,
              displayBounds: display.bounds,
              scaleFactor: display.scaleFactor,
            })})`,
            true,
          )
        } catch {
          finish({ ok: false, code: 'capture-cancelled' })
        }
      },
    )

    if (!captureWindow || typeof captureWindow.id !== 'number') {
      finish({ ok: false, code: 'capture-cancelled' })
      return
    }

    channel = `screen-translation:capture:${captureWindow.id}`
    ipcRenderer.on(channel, handleMessage)
  })
}

module.exports = {
  captureImageWithCustomOverlay,
}
