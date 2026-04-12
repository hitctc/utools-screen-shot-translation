const activePinWindowsById = new Map()
const activePinWindowIdByRecordId = new Map()
const {
  removeEdgeNearWhitePixels,
  findVisibleContentBounds,
  scaleContentBoundsToTarget,
} = require('./pinImageMask.cjs')
// 这里给外围蓝色描边预留固定空间，保证边框画在图片外侧而不压住内容。
const PIN_WINDOW_SHADOW_MARGIN = 6
const PIN_WINDOW_DEFAULT_MARGIN = 24
const MIN_PIN_CONTENT_SHORT_EDGE = 80
const MAX_PIN_CONTENT_LONG_EDGE = 4096

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

function resolveImageSize(imageSrc, electron) {
  const nativeImage = loadElectronModule(electron)?.nativeImage
  const normalizedImageSrc = typeof imageSrc === 'string' ? imageSrc.trim() : ''

  if (!nativeImage || typeof nativeImage.createFromDataURL !== 'function' || !normalizedImageSrc) {
    return null
  }

  try {
    const image = nativeImage.createFromDataURL(normalizedImageSrc)
    return normalizePinBounds({
      x: 0,
      y: 0,
      width: image?.getSize?.()?.width,
      height: image?.getSize?.()?.height,
    })
  } catch {
    return null
  }
}

// 主流程不再依赖截图选区坐标，没有历史位置时统一落到当前屏幕右上角。
function resolveDefaultPinBounds({ utools, imageSrc, electron }) {
  const imageSize = resolveImageSize(imageSrc, electron)
  const display =
    typeof utools?.getDisplayNearestPoint === 'function' && typeof utools?.getCursorScreenPoint === 'function'
      ? utools.getDisplayNearestPoint(utools.getCursorScreenPoint())
      : null
  const displayBounds = display?.bounds
  const normalizedDisplayBounds = normalizePinBounds(
    displayBounds
      ? {
          x: displayBounds.x,
          y: displayBounds.y,
          width: displayBounds.width,
          height: displayBounds.height,
        }
      : null,
  )

  if (!imageSize || !normalizedDisplayBounds) {
    return null
  }

  return {
    x: normalizedDisplayBounds.x + normalizedDisplayBounds.width - imageSize.width - PIN_WINDOW_DEFAULT_MARGIN,
    y: normalizedDisplayBounds.y + PIN_WINDOW_DEFAULT_MARGIN,
    width: imageSize.width,
    height: imageSize.height,
  }
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function convertBgraBitmapToRgba(bitmapBuffer) {
  if (!Buffer.isBuffer(bitmapBuffer) && !(bitmapBuffer instanceof Uint8Array)) {
    return null
  }

  const source = bitmapBuffer instanceof Uint8Array ? bitmapBuffer : Uint8Array.from(bitmapBuffer)
  if (source.length % 4 !== 0) {
    return null
  }

  const rgba = new Uint8ClampedArray(source.length)
  for (let index = 0; index < source.length; index += 4) {
    rgba[index] = source[index + 2]
    rgba[index + 1] = source[index + 1]
    rgba[index + 2] = source[index]
    rgba[index + 3] = source[index + 3]
  }

  return rgba
}

function normalizeAnchorRatio(value) {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) {
    return 0.5
  }

  return clampNumber(ratio, 0, 1)
}

// 钉住图的首帧如果直接带着整张白底，会让用户误以为又弹出一个空白主窗口。
// 这里在 preload 里先按像素清理边缘浅底并裁切内容，再把更紧凑的位图交给 pin window。
function preparePinWindowPayload({ imageSrc, bounds, electron }) {
  const nativeImage = loadElectronModule(electron)?.nativeImage
  const normalizedBounds = normalizePinBounds(bounds)
  const normalizedImageSrc = typeof imageSrc === 'string' ? imageSrc.trim() : ''

  if (
    !nativeImage ||
    typeof nativeImage.createFromDataURL !== 'function' ||
    !normalizedBounds ||
    !normalizedImageSrc
  ) {
    return {
      imageSrc: normalizedImageSrc,
      bounds: normalizedBounds,
    }
  }

  try {
    const sourceImage = nativeImage.createFromDataURL(normalizedImageSrc)
    const sourceSize = sourceImage?.getSize?.()
    const sourceWidth = Math.round(Number(sourceSize?.width))
    const sourceHeight = Math.round(Number(sourceSize?.height))
    const bitmap = sourceImage?.toBitmap?.()
    const rgbaPixels = convertBgraBitmapToRgba(bitmap)

    if (
      !Number.isFinite(sourceWidth) ||
      !Number.isFinite(sourceHeight) ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      !rgbaPixels
    ) {
      return {
        imageSrc: normalizedImageSrc,
        bounds: normalizedBounds,
      }
    }

    const cleanedPixels = removeEdgeNearWhitePixels({
      data: rgbaPixels,
      width: sourceWidth,
      height: sourceHeight,
    })
    const contentBounds = findVisibleContentBounds({
      data: cleanedPixels,
      width: sourceWidth,
      height: sourceHeight,
    })

    if (
      !contentBounds ||
      (contentBounds.x === 0 &&
        contentBounds.y === 0 &&
        contentBounds.width === sourceWidth &&
        contentBounds.height === sourceHeight)
    ) {
      return {
        imageSrc: normalizedImageSrc,
        bounds: normalizedBounds,
      }
    }

    const projectedBounds = scaleContentBoundsToTarget({
      sourceWidth,
      sourceHeight,
      targetWidth: normalizedBounds.width,
      targetHeight: normalizedBounds.height,
      bounds: contentBounds,
    })
    const nextContentBounds = normalizePinBounds(
      projectedBounds
        ? {
            x: normalizedBounds.x + projectedBounds.x,
            y: normalizedBounds.y + projectedBounds.y,
            width: projectedBounds.width,
            height: projectedBounds.height,
          }
        : null,
    )

    const croppedImage = sourceImage?.crop?.({
      x: contentBounds.x,
      y: contentBounds.y,
      width: contentBounds.width,
      height: contentBounds.height,
    })
    const croppedImageSrc =
      typeof croppedImage?.toDataURL === 'function' ? croppedImage.toDataURL() : normalizedImageSrc

    return {
      imageSrc: croppedImageSrc || normalizedImageSrc,
      bounds: nextContentBounds || normalizedBounds,
    }
  } catch {
    return {
      imageSrc: normalizedImageSrc,
      bounds: normalizedBounds,
    }
  }
}

function toWindowBounds(contentBounds) {
  const bounds = normalizePinBounds(contentBounds)

  if (!bounds) {
    return null
  }

  return {
    x: bounds.x - PIN_WINDOW_SHADOW_MARGIN,
    y: bounds.y - PIN_WINDOW_SHADOW_MARGIN,
    width: bounds.width + PIN_WINDOW_SHADOW_MARGIN * 2,
    height: bounds.height + PIN_WINDOW_SHADOW_MARGIN * 2,
  }
}

function toContentBounds(windowBounds) {
  const bounds = normalizePinBounds(windowBounds)

  if (!bounds) {
    return null
  }

  return {
    x: bounds.x + PIN_WINDOW_SHADOW_MARGIN,
    y: bounds.y + PIN_WINDOW_SHADOW_MARGIN,
    width: Math.max(1, bounds.width - PIN_WINDOW_SHADOW_MARGIN * 2),
    height: Math.max(1, bounds.height - PIN_WINDOW_SHADOW_MARGIN * 2),
  }
}

// 缩放直接改真实内容区几何，后续继续复用 lastPinBounds 持久化，不单独维护 scale 状态。
function scaleContentBounds(currentContentBounds, payload = {}) {
  const bounds = normalizePinBounds(currentContentBounds)
  const scaleFactor = Number(payload.scaleFactor)

  if (!bounds || !Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    return null
  }

  const shortEdge = Math.max(1, Math.min(bounds.width, bounds.height))
  const longEdge = Math.max(bounds.width, bounds.height)
  const appliedScale = clampNumber(
    scaleFactor,
    MIN_PIN_CONTENT_SHORT_EDGE / shortEdge,
    MAX_PIN_CONTENT_LONG_EDGE / longEdge,
  )
  const anchorRatioX = normalizeAnchorRatio(payload.anchorRatioX)
  const anchorRatioY = normalizeAnchorRatio(payload.anchorRatioY)
  const nextWidth = Math.max(1, Math.round(bounds.width * appliedScale))
  const nextHeight = Math.max(1, Math.round(bounds.height * appliedScale))

  return normalizePinBounds({
    x: Math.round(bounds.x + anchorRatioX * (bounds.width - nextWidth)),
    y: Math.round(bounds.y + anchorRatioY * (bounds.height - nextHeight)),
    width: nextWidth,
    height: nextHeight,
  })
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

  const windowBounds = normalizePinBounds(explicitBounds || entry.bounds)
  const contentBounds = toContentBounds(windowBounds)

  if (!windowBounds || !contentBounds) {
    return
  }

  await entry.persistRecordPinState(entry.recordId, contentBounds)
  entry.bounds = windowBounds
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

function normalizeRelativeContentBounds(payload) {
  const bounds = normalizePinBounds(payload)

  if (!bounds) {
    return null
  }

  return bounds
}

// 缩放和内容区收缩优先走一次 setBounds，减少 setPosition + setSize 拆开带来的窗口抖动。
function applyWindowBounds(windowInstance, nextBounds) {
  const bounds = normalizePinBounds(nextBounds)

  if (!windowInstance || !bounds) {
    return
  }

  if (typeof windowInstance.setBounds === 'function') {
    windowInstance.setBounds(bounds, false)
    return
  }

  windowInstance.setPosition?.(bounds.x, bounds.y)
  windowInstance.setSize?.(bounds.width, bounds.height)
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
      entry.windowInstance?.focus?.()
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

    if (payload.type === 'content-bounds') {
      const currentContentBounds = toContentBounds(entry.bounds)
      const relativeContentBounds = normalizeRelativeContentBounds(payload)

      if (!currentContentBounds || !relativeContentBounds) {
        return
      }

      const nextContentBounds = normalizePinBounds({
        x: currentContentBounds.x + relativeContentBounds.x,
        y: currentContentBounds.y + relativeContentBounds.y,
        width: relativeContentBounds.width,
        height: relativeContentBounds.height,
      })
      const nextWindowBounds = toWindowBounds(nextContentBounds)

      if (!nextContentBounds || !nextWindowBounds) {
        return
      }

      entry.bounds = nextWindowBounds

      try {
        applyWindowBounds(entry.windowInstance, nextWindowBounds)
      } catch {
        // 内容区收缩只影响显示效果，失败时不继续往外抛。
      }

      if (entry.recordId) {
        await persistEntryBounds(entry, nextWindowBounds)
      }

      return
    }

    if (payload.type === 'zoom') {
      if (payload.phase === 'end') {
        await persistEntryBounds(entry)
        return
      }

      const currentContentBounds = toContentBounds(entry.bounds)
      const nextContentBounds = scaleContentBounds(currentContentBounds, payload)
      const nextWindowBounds = toWindowBounds(nextContentBounds)

      if (!nextContentBounds || !nextWindowBounds) {
        return
      }

      entry.bounds = nextWindowBounds

      try {
        applyWindowBounds(entry.windowInstance, nextWindowBounds)
      } catch {
        // 缩放只影响当前窗口显示，窗口已销毁时直接丢弃即可。
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
  const effectiveBounds =
    normalizePinBounds(bounds) || resolveDefaultPinBounds({ utools: runtime, imageSrc, electron })
  const preparedPayload = preparePinWindowPayload({
    imageSrc,
    bounds: effectiveBounds,
    electron,
  })
  const normalizedBounds = normalizePinBounds(preparedPayload.bounds)
  const windowBounds = toWindowBounds(preparedPayload.bounds)
  const normalizedImageSrc = typeof preparedPayload.imageSrc === 'string' ? preparedPayload.imageSrc.trim() : ''

  if (
    !runtime ||
    typeof runtime.createBrowserWindow !== 'function' ||
    !ipcRenderer ||
    typeof ipcRenderer.on !== 'function' ||
    typeof ipcRenderer.off !== 'function' ||
    !normalizedBounds ||
    !windowBounds ||
    !normalizedImageSrc
  ) {
    return Promise.resolve({ ok: false, code: 'pin-failed' })
  }

  return new Promise((resolve) => {
    let pinWindow = null
    let channel = ''
    let settled = false

    function settle(result) {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    pinWindow = runtime.createBrowserWindow(
      resolveAssetUrl('pin-window.html'),
      {
        x: windowBounds.x,
        y: windowBounds.y,
        width: windowBounds.width,
        height: windowBounds.height,
        frame: false,
        resizable: false,
        movable: false,
        closable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        transparent: true,
        // 先别把子窗口露出来，等首帧图片准备好后再显示，避免用户先看到一块空白壳子。
        show: false,
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
              frameInset: PIN_WINDOW_SHADOW_MARGIN,
              imageSrc: normalizedImageSrc,
            })})`,
            true,
          )
          pinWindow?.show?.()
          settle({
            ok: true,
            windowId: pinWindow.id,
            bounds: normalizedBounds,
          })
        } catch {
          cleanupEntry(activePinWindowsById.get(pinWindow?.id), ipcRenderer)
          closeWindow(pinWindow)
          settle({ ok: false, code: 'pin-failed' })
        }
      },
    )

    if (!pinWindow || typeof pinWindow.id !== 'number') {
      settle({ ok: false, code: 'pin-failed' })
      return
    }

    channel = `screen-translation:pin:${pinWindow.id}`
    buildPinWindowEntry({
      windowInstance: pinWindow,
      windowId: pinWindow.id,
      channel,
      initialBounds: windowBounds,
      ipcRenderer,
      persistRecordPinState,
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
      activeEntry.windowInstance?.restore?.()
      activeEntry.windowInstance?.show?.()
      activeEntry.windowInstance?.setAlwaysOnTop?.(true)
      activeEntry.windowInstance?.moveTop?.()
      activeEntry.windowInstance?.focus?.()
      await activeEntry.windowInstance?.webContents?.executeJavaScript?.(
        'window.__SCREEN_TRANSLATION_PIN_ATTENTION__?.()',
        true,
      )
    } catch {
      // 已钉住提醒只影响体验，不阻塞主流程。
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
