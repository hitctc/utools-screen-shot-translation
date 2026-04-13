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

function resolveThumbnailDataUrl(thumbnail) {
  if (!thumbnail || typeof thumbnail !== 'object') {
    return ''
  }

  if (typeof thumbnail.toDataURL === 'function') {
    return String(thumbnail.toDataURL()).trim()
  }

  if (typeof thumbnail.toPNG === 'function') {
    return `data:image/png;base64,${Buffer.from(thumbnail.toPNG()).toString('base64')}`
  }

  return ''
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

function waitForMainWindowToHide() {
  return new Promise((resolve) => {
    setTimeout(resolve, 120)
  })
}

function waitForNextCaptureSample() {
  return new Promise((resolve) => {
    setTimeout(resolve, 80)
  })
}

function concealPluginWindow(runtime) {
  const windowType = typeof runtime?.getWindowType === 'function' ? runtime.getWindowType() : 'main'

  if (windowType === 'detach' && typeof runtime?.outPlugin === 'function') {
    runtime.outPlugin()
    return {
      canRestoreMainWindow: typeof runtime?.showMainWindow === 'function',
    }
  }

  if (typeof runtime?.hideMainWindow === 'function') {
    runtime.hideMainWindow()
    return {
      canRestoreMainWindow: true,
    }
  }

  return {
    canRestoreMainWindow: false,
  }
}

function restoreMainWindow(runtime, canRestoreMainWindow) {
  if (!canRestoreMainWindow || typeof runtime?.showMainWindow !== 'function') {
    return
  }

  try {
    runtime.showMainWindow()
  } catch {
    // 主窗口恢复失败时，这里也只做静默兜底，避免吞掉真正的截图结果。
  }
}

function captureDisplayImageDataUrl({ desktopCaptureSources, display }) {
  return desktopCaptureSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.max(1, Math.round(display.bounds.width * display.scaleFactor)),
      height: Math.max(1, Math.round(display.bounds.height * display.scaleFactor)),
    },
  }).then((sources) => {
    const matchedSource =
      (Array.isArray(sources) ? sources : []).find(
        (source) => String(source?.display_id || '') === String(display.id),
      ) || (Array.isArray(sources) ? sources[0] : null)

    return resolveThumbnailDataUrl(matchedSource?.thumbnail)
  })
}

// 这里不再用单次采样赌主窗口已经消失，而是等冻结画面稳定后再进入选区。
async function captureStableDisplayImageDataUrl({
  desktopCaptureSources,
  display,
  waitForNextSample = waitForNextCaptureSample,
  maxAttempts = 5,
} = {}) {
  let previousImageDataUrl = ''

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentImageDataUrl = await captureDisplayImageDataUrl({
      desktopCaptureSources,
      display,
    })

    if (!currentImageDataUrl) {
      return ''
    }

    if (previousImageDataUrl && previousImageDataUrl === currentImageDataUrl) {
      return currentImageDataUrl
    }

    previousImageDataUrl = currentImageDataUrl

    if (attempt < maxAttempts - 1) {
      await waitForNextSample()
    }
  }

  return previousImageDataUrl
}

// 自定义截图只负责拉起全屏选区并把图片与原始坐标带回主流程，不处理翻译和钉图。
function captureImageWithCustomOverlay({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
  waitForMainWindowHide = waitForMainWindowToHide,
  waitForStableCaptureFrame = waitForNextCaptureSample,
} = {}) {
  const runtime = utools && typeof utools === 'object' ? utools : null
  const electronModule = loadElectronModule(electron)
  const ipcRenderer = electronModule?.ipcRenderer

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

  const desktopCaptureSources =
    typeof runtime.desktopCaptureSources === 'function' ? runtime.desktopCaptureSources.bind(runtime) : null
  if (!desktopCaptureSources) {
    return Promise.resolve({ ok: false, code: 'capture-cancelled' })
  }

  let didHideMainWindow = false
  let canRestoreMainWindow = false

  const prepareMainWindowForCapture = async () => {
    try {
      const concealResult = concealPluginWindow(runtime)
      didHideMainWindow = true
      canRestoreMainWindow = concealResult.canRestoreMainWindow

      // 先收起当前插件窗口，再去采样整屏背景，避免把插件自己的窗体一起拍进截图层。
      await waitForMainWindowHide()
    } catch {
      didHideMainWindow = false
      canRestoreMainWindow = false
    }
  }

  return prepareMainWindowForCapture()
    .then(() =>
      new Promise((resolve) => {
        let captureWindow = null
        let finished = false
        let channel = ''

        const finish = (result, shouldRestoreMainWindow = true) => {
          if (finished) {
            return
          }

          finished = true
          if (channel) {
            ipcRenderer.off(channel, handleMessage)
          }
          closeWindow(captureWindow)
          if (shouldRestoreMainWindow) {
            restoreMainWindow(runtime, didHideMainWindow && canRestoreMainWindow)
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

            if (!bounds || !image.startsWith('data:image/')) {
              finish({ ok: false, code: 'capture-cancelled' })
              return
            }

            finish(
              {
                ok: true,
                image,
                bounds,
              },
              false,
            )
            return
          }

          finish({ ok: false, code: 'capture-cancelled' })
        }

        const openCaptureOverlay = async (imageDataUrl) => {
          captureWindow = runtime.createBrowserWindow(
            resolveAssetUrl('capture-overlay.html'),
            {
              x: display.bounds.x,
              y: display.bounds.y,
              width: display.bounds.width,
              height: display.bounds.height,
              backgroundColor: 'rgba(255,255,255,0.01)',
              thickFrame: false,
              frame: false,
              resizable: false,
              movable: false,
              closable: true,
              minimizable: false,
              maximizable: false,
              autoHideMenuBar: true,
              skipTaskbar: true,
              alwaysOnTop: true,
              transparent: true,
              enableLargerThanScreen: true,
              roundedCorners: false,
              hasShadow: false,
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
                    displayBounds: display.bounds,
                    imageDataUrl,
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
          try {
            captureWindow.setAlwaysOnTop?.(true, 'screen-saver')
          } catch {
            // 不同平台上置顶级别支持不同，这里失败时继续保留普通置顶即可。
          }
        }

        captureStableDisplayImageDataUrl({
          desktopCaptureSources,
          display,
          waitForNextSample: waitForStableCaptureFrame,
        })
          .then((imageDataUrl) => {
            if (!imageDataUrl) {
              finish({ ok: false, code: 'capture-cancelled' })
              return
            }

            void openCaptureOverlay(imageDataUrl).catch(() => {
              finish({ ok: false, code: 'capture-cancelled' })
            })
          })
          .catch(() => {
            finish({ ok: false, code: 'capture-cancelled' })
          })
      })
    )
    .catch(() => {
      restoreMainWindow(runtime, didHideMainWindow && canRestoreMainWindow)
      return { ok: false, code: 'capture-cancelled' }
    })
}

module.exports = {
  captureImageWithCustomOverlay,
}
