const activePegWindowsById = new Map()
const activePegWindowIdByRecordId = new Map()
const {
  removeEdgeNearWhitePixels,
  findVisibleContentBounds,
  scaleContentBoundsToTarget,
} = require('./pegImageMask.cjs')
// 蓝框本身占用独立厚度，窗口几何需要把这层边框也算进去，避免图片内容被边框吃掉。
const PEG_WINDOW_FRAME_MARGIN = 6
const MIN_PEG_CONTENT_SHORT_EDGE = 80
const MAX_PEG_CONTENT_LONG_EDGE = 4096

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

function normalizePegBounds(bounds) {
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

function normalizeDisplayMetrics(display) {
  const candidate = display && typeof display === 'object' ? display : {}
  const bounds = normalizePegBounds(
    candidate.bounds
      ? {
          x: candidate.bounds.x,
          y: candidate.bounds.y,
          width: candidate.bounds.width,
          height: candidate.bounds.height,
        }
      : null,
  )
  const scaleFactor = Number(candidate.scaleFactor)

  if (!bounds) {
    return null
  }

  return {
    bounds,
    scaleFactor: Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1,
  }
}

function resolveImageSize(imageSrc, electron) {
  const nativeImage = loadElectronModule(electron)?.nativeImage
  const normalizedImageSrc = typeof imageSrc === 'string' ? imageSrc.trim() : ''

  if (!nativeImage || typeof nativeImage.createFromDataURL !== 'function' || !normalizedImageSrc) {
    return null
  }

  try {
    const image = nativeImage.createFromDataURL(normalizedImageSrc)
    return normalizePegBounds({
      x: 0,
      y: 0,
      width: image?.getSize?.()?.width,
      height: image?.getSize?.()?.height,
    })
  } catch {
    return null
  }
}

// 主流程不再依赖截图选区坐标，没有历史位置时统一把可见内容贴到当前屏幕左上角。
function resolveDefaultPegBounds({ utools, imageSrc, electron }) {
  const imageSize = resolveImageSize(imageSrc, electron)
  const display =
    typeof utools?.getDisplayNearestPoint === 'function' && typeof utools?.getCursorScreenPoint === 'function'
      ? utools.getDisplayNearestPoint(utools.getCursorScreenPoint())
      : null
  const normalizedDisplay = normalizeDisplayMetrics(display)
  const normalizedDisplayBounds = normalizedDisplay?.bounds
  const displayScaleFactor = normalizedDisplay?.scaleFactor || 1

  if (!imageSize || !normalizedDisplayBounds) {
    return null
  }

  const logicalWidth = Math.max(1, Math.round(imageSize.width / displayScaleFactor))
  const logicalHeight = Math.max(1, Math.round(imageSize.height / displayScaleFactor))

  return {
    x: normalizedDisplayBounds.x + PEG_WINDOW_FRAME_MARGIN,
    y: normalizedDisplayBounds.y + PEG_WINDOW_FRAME_MARGIN,
    width: logicalWidth,
    height: logicalHeight,
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

// 钉图的首帧如果直接带着整张白底，会让用户误以为又弹出一个空白主窗口。
// 这里在 preload 里先按像素清理边缘浅底并裁切内容，再把更紧凑的位图交给 peg window。
function preparePegWindowPayload({ imageSrc, bounds, electron, preserveBounds = false }) {
  const nativeImage = loadElectronModule(electron)?.nativeImage
  const normalizedBounds = normalizePegBounds(bounds)
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

    // 重复钉图带进来的 lastPegBounds 已经是上次裁切后的真实内容区尺寸，
    // 这里只继续复用裁切后的图片，不能再按原图比例把 bounds 缩一次。
    const projectedBounds = preserveBounds
      ? normalizedBounds
      : scaleContentBoundsToTarget({
          sourceWidth,
          sourceHeight,
          targetWidth: normalizedBounds.width,
          targetHeight: normalizedBounds.height,
          bounds: contentBounds,
        })
    const nextContentBounds = normalizePegBounds(
      projectedBounds
        ? {
            x: preserveBounds ? normalizedBounds.x : normalizedBounds.x + projectedBounds.x,
            y: preserveBounds ? normalizedBounds.y : normalizedBounds.y + projectedBounds.y,
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

// 窗口外层现在就是可见蓝框本体，所以要把边框厚度一起包进窗口几何。
function toWindowBounds(contentBounds) {
  const bounds = normalizePegBounds(contentBounds)

  if (!bounds) {
    return null
  }

  return {
    x: bounds.x - PEG_WINDOW_FRAME_MARGIN,
    y: bounds.y - PEG_WINDOW_FRAME_MARGIN,
    width: bounds.width + PEG_WINDOW_FRAME_MARGIN * 2,
    height: bounds.height + PEG_WINDOW_FRAME_MARGIN * 2,
  }
}

// 持久化仍只记图片内容区，不把外层蓝框厚度写回记录。
function toContentBounds(windowBounds) {
  const bounds = normalizePegBounds(windowBounds)

  if (!bounds) {
    return null
  }

  return {
    x: bounds.x + PEG_WINDOW_FRAME_MARGIN,
    y: bounds.y + PEG_WINDOW_FRAME_MARGIN,
    width: Math.max(1, bounds.width - PEG_WINDOW_FRAME_MARGIN * 2),
    height: Math.max(1, bounds.height - PEG_WINDOW_FRAME_MARGIN * 2),
  }
}

// 缩放直接改真实内容区几何，后续继续复用 lastPegBounds 持久化，不单独维护 scale 状态。
function scaleContentBounds(currentContentBounds, payload = {}) {
  const bounds = normalizePegBounds(currentContentBounds)
  const scaleFactor = Number(payload.scaleFactor)

  if (!bounds || !Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    return null
  }

  const shortEdge = Math.max(1, Math.min(bounds.width, bounds.height))
  const longEdge = Math.max(bounds.width, bounds.height)
  const appliedScale = clampNumber(
    scaleFactor,
    MIN_PEG_CONTENT_SHORT_EDGE / shortEdge,
    MAX_PEG_CONTENT_LONG_EDGE / longEdge,
  )
  const anchorRatioX = normalizeAnchorRatio(payload.anchorRatioX)
  const anchorRatioY = normalizeAnchorRatio(payload.anchorRatioY)
  const nextWidth = Math.max(1, Math.round(bounds.width * appliedScale))
  const nextHeight = Math.max(1, Math.round(bounds.height * appliedScale))

  return normalizePegBounds({
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
  const windowId = activePegWindowIdByRecordId.get(recordId)
  if (!windowId) {
    return null
  }

  const entry = activePegWindowsById.get(windowId)
  if (!entry) {
    activePegWindowIdByRecordId.delete(recordId)
    return null
  }

  if (entry.windowInstance?.isDestroyed?.()) {
    activePegWindowsById.delete(windowId)
    activePegWindowIdByRecordId.delete(recordId)
    return null
  }

  return entry
}

async function persistEntryBounds(entry, explicitBounds) {
  if (!entry || !entry.recordId || typeof entry.persistRecordPegState !== 'function') {
    return
  }

  const windowBounds = normalizePegBounds(explicitBounds || entry.bounds)
  const contentBounds = toContentBounds(windowBounds)

  if (!windowBounds || !contentBounds) {
    return
  }

  await entry.persistRecordPegState(entry.recordId, contentBounds)
  entry.bounds = windowBounds
}

function cleanupEntry(entry, ipcRenderer) {
  if (!entry) {
    return
  }

  activePegWindowsById.delete(entry.windowId)
  if (entry.recordId) {
    activePegWindowIdByRecordId.delete(entry.recordId)
  }
  if (entry.channel && ipcRenderer?.off && entry.handleMessage) {
    ipcRenderer.off(entry.channel, entry.handleMessage)
  }
}

function normalizeRelativeContentBounds(payload) {
  const bounds = normalizePegBounds(payload)

  if (!bounds) {
    return null
  }

  return bounds
}

// 缩放和内容区收缩优先走一次 setBounds，减少 setPosition + setSize 拆开带来的窗口抖动。
function applyWindowBounds(windowInstance, nextBounds) {
  const bounds = normalizePegBounds(nextBounds)

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

function buildPegWindowEntry({
  windowInstance,
  windowId,
  channel,
  initialBounds,
  ipcRenderer,
  persistRecordPegState,
}) {
  const entry = {
    windowInstance,
    windowId,
    channel,
    ipcRenderer,
    recordId: '',
    bounds: normalizePegBounds(initialBounds),
    dragState: null,
    persistRecordPegState,
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

      const nextBounds = normalizePegBounds({
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

      const nextContentBounds = normalizePegBounds({
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
  activePegWindowsById.set(windowId, entry)
  return entry
}

function openPegWindow({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
  imageSrc,
  bounds,
  persistRecordPegState,
  preserveBoundsOnPreprocess = false,
}) {
  const runtime = utools && typeof utools === 'object' ? utools : null
  const ipcRenderer = loadElectronModule(electron)?.ipcRenderer
  const effectiveBounds =
    normalizePegBounds(bounds) || resolveDefaultPegBounds({ utools: runtime, imageSrc, electron })
  const preparedPayload = preparePegWindowPayload({
    imageSrc,
    bounds: effectiveBounds,
    electron,
    preserveBounds: preserveBoundsOnPreprocess,
  })
  const normalizedBounds = normalizePegBounds(preparedPayload.bounds)
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
    return Promise.resolve({ ok: false, code: 'peg-failed' })
  }

  return new Promise((resolve) => {
    let pegWindow = null
    let channel = ''
    let settled = false

    function settle(result) {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    pegWindow = runtime.createBrowserWindow(
      resolveAssetUrl('peg-window.html'),
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
          await pegWindow.webContents.executeJavaScript(
            `window.__SCREEN_TRANSLATION_PEG_INIT__(${JSON.stringify({
              channel,
              frameInset: PEG_WINDOW_FRAME_MARGIN,
              imageSrc: normalizedImageSrc,
            })})`,
            true,
          )
          pegWindow?.show?.()
          settle({
            ok: true,
            windowId: pegWindow.id,
            bounds: normalizedBounds,
          })
        } catch {
          cleanupEntry(activePegWindowsById.get(pegWindow?.id), ipcRenderer)
          closeWindow(pegWindow)
          settle({ ok: false, code: 'peg-failed' })
        }
      },
    )

    if (!pegWindow || typeof pegWindow.id !== 'number') {
      settle({ ok: false, code: 'peg-failed' })
      return
    }

    channel = `screen-translation:peg:${pegWindow.id}`
    buildPegWindowEntry({
      windowInstance: pegWindow,
      windowId: pegWindow.id,
      channel,
      initialBounds: windowBounds,
      ipcRenderer,
      persistRecordPegState,
    })
  })
}

// 主流程 peg 成功后，保存记录才会生成 recordId，这一步把活动窗口补上正式关联关系。
async function attachPeggedRecord({
  windowId,
  recordId,
  persistRecordPegState,
}) {
  const entry = activePegWindowsById.get(windowId)
  if (!entry || !recordId) {
    return { ok: false, code: 'peg-failed' }
  }

  entry.recordId = recordId
  entry.persistRecordPegState = persistRecordPegState
  activePegWindowIdByRecordId.set(recordId, windowId)
  await persistEntryBounds(entry)

  return { ok: true, windowId, recordId }
}

// 记录页重钉图前先查活动窗口，避免同一张图被重复创建多个钉图实例。
async function repegSavedRecordImage({
  utools,
  electron,
  resolveAssetUrl = (assetPath) => assetPath,
  record,
  imageSrc,
  persistRecordPegState,
}) {
  if (!record || typeof record.id !== 'string') {
    return { ok: false, code: 'repeg-failed' }
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
        'window.__SCREEN_TRANSLATION_PEG_ATTENTION__?.()',
        true,
      )
    } catch {
      // 已钉图提醒只影响体验，不阻塞主流程。
    }

    return { ok: true, code: 'already-pegged' }
  }

  const result = await openPegWindow({
    utools,
    electron,
    resolveAssetUrl,
    imageSrc,
    bounds: record.lastPegBounds,
    persistRecordPegState,
    preserveBoundsOnPreprocess: normalizePegBounds(record.lastPegBounds) !== null,
  })

  if (!result.ok) {
    return { ok: false, code: 'repeg-failed' }
  }

  await attachPeggedRecord({
    windowId: result.windowId,
    recordId: record.id,
    persistRecordPegState,
  })

  return result
}

module.exports = {
  pegTranslatedImage: openPegWindow,
  attachPeggedRecord,
  repegSavedRecordImage,
}
