import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

function loadPinWindowManager() {
  const modulePath = path.resolve('public/preload/pinWindowManager.cjs')
  delete require.cache[modulePath]
  return require('../../public/preload/pinWindowManager.cjs')
}

function createBgraBitmap(width, height, fillPixel) {
  const data = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = fillPixel(x, y)
      const offset = (y * width + x) * 4
      data[offset] = blue
      data[offset + 1] = green
      data[offset + 2] = red
      data[offset + 3] = alpha
    }
  }

  return data
}

test('pinTranslatedImage creates a pin window with only the outer border margin', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  let capturedOptions = null
  const calls = []
  const utools = {
    createBrowserWindow: (_url, options, callback) => {
      capturedOptions = options
      queueMicrotask(() => callback?.())
      return {
        id: 1002,
        webContents: {
          executeJavaScript: async () => true,
        },
        show: () => calls.push('show'),
        isDestroyed: () => false,
      }
    },
  }
  const electron = {
    ipcRenderer: {
      on: () => {},
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 10, y: 20, width: 120, height: 90 })
  assert.equal(capturedOptions?.hasShadow, false)
  assert.equal(capturedOptions?.show, false)
  assert.deepEqual(calls, ['show'])
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 4,
      y: 14,
      width: 132,
      height: 102,
    },
  )
})

test('pinTranslatedImage defaults to top-right when no historical bounds exist', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  let capturedOptions = null
  const utools = {
    getCursorScreenPoint: () => ({ x: 10, y: 10 }),
    getDisplayNearestPoint: () => ({
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
    }),
    createBrowserWindow: (_url, options, callback) => {
      capturedOptions = options
      queueMicrotask(() => callback?.())
      return {
        id: 1004,
        webContents: {
          executeJavaScript: async () => true,
        },
        show: () => {},
        isDestroyed: () => false,
      }
    },
  }
  const electron = {
    ipcRenderer: {
      on: () => {},
      off: () => {},
    },
    nativeImage: {
      createFromDataURL: () => ({
        getSize: () => ({ width: 80, height: 40 }),
        toBitmap: () => createBgraBitmap(80, 40, () => [255, 255, 255, 255]),
      }),
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,translated',
    bounds: null,
    persistRecordPinState: async () => null,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 1336, y: 24, width: 80, height: 40 })
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 1330,
      y: 18,
      width: 92,
      height: 52,
    },
  )
})

test('pinTranslatedImage preprocesses white-edge images before opening the pin window', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  let capturedOptions = null
  let executedScript = ''
  let croppedRect = null
  const bitmap = createBgraBitmap(6, 6, (x, y) => {
    if (x >= 2 && x <= 3 && y >= 2 && y <= 3) {
      return [24, 24, 24, 255]
    }

    return [255, 255, 255, 255]
  })
  const utools = {
    createBrowserWindow: (_url, options, callback) => {
      capturedOptions = options
      queueMicrotask(() => callback?.())
      return {
        id: 1010,
        webContents: {
          executeJavaScript: async (script) => {
            executedScript = script
            return true
          },
        },
        show: () => {},
        isDestroyed: () => false,
      }
    },
  }
  const electron = {
    ipcRenderer: {
      on: () => {},
      off: () => {},
    },
    nativeImage: {
      createFromDataURL: () => ({
        getSize: () => ({ width: 6, height: 6 }),
        toBitmap: () => bitmap,
        crop: (rect) => {
          croppedRect = rect
          return {
            toDataURL: () => 'data:image/png;base64,cropped-image',
          }
        },
      }),
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,source-image',
    bounds: { x: 100, y: 200, width: 120, height: 60 },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 120, y: 210, width: 80, height: 40 })
  assert.deepEqual(croppedRect, { x: 1, y: 1, width: 4, height: 4 })
  assert.match(executedScript, /cropped-image/)
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 114,
      y: 204,
      width: 92,
      height: 52,
    },
  )
})

test('repinSavedRecordImage restores and focuses an already pinned window', async () => {
  const {
    pinTranslatedImage,
    attachPinnedRecord,
    repinSavedRecordImage,
  } = loadPinWindowManager()
  const calls = []
  const windowInstance = {
    id: 1001,
    webContents: {
      executeJavaScript: async (script) => {
        calls.push(`execute:${script}`)
        return true
      },
    },
    isDestroyed: () => false,
    setAlwaysOnTop: () => calls.push('setAlwaysOnTop'),
    moveTop: () => calls.push('moveTop'),
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
  }
  const utools = {
    createBrowserWindow: (_url, _options, callback) => {
      queueMicrotask(() => callback?.())
      return windowInstance
    },
  }
  const electron = {
    ipcRenderer: {
      on: () => {},
      off: () => {},
    },
  }

  const openResult = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(openResult.ok, true)
  await attachPinnedRecord({
    windowId: openResult.windowId,
    recordId: 'record-1',
  })

  calls.length = 0

  const repinResult = await repinSavedRecordImage({
    utools,
    electron,
    record: {
      id: 'record-1',
      lastPinBounds: { x: 10, y: 20, width: 120, height: 90 },
    },
    imageSrc: 'file:///tmp/translated.png',
  })

  assert.deepEqual(repinResult, {
    ok: true,
    code: 'already-pinned',
  })
  assert.deepEqual(calls, [
    'restore',
    'show',
    'setAlwaysOnTop',
    'moveTop',
    'focus',
    'execute:window.__SCREEN_TRANSLATION_PIN_ATTENTION__?.()',
  ])
})

test('pinTranslatedImage shrinks the window to the reported content bounds while keeping the outer border margin', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  const handlers = new Map()
  const geometryCalls = []
  const windowInstance = {
    id: 1003,
    webContents: {
      executeJavaScript: async () => true,
    },
    isDestroyed: () => false,
    setPosition: (x, y) => geometryCalls.push(['setPosition', x, y]),
    setSize: (width, height) => geometryCalls.push(['setSize', width, height]),
  }
  const utools = {
    createBrowserWindow: (_url, _options, callback) => {
      queueMicrotask(() => callback?.())
      return windowInstance
    },
  }
  const electron = {
    ipcRenderer: {
      on: (channel, handler) => handlers.set(channel, handler),
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 100, y: 200, width: 400, height: 120 },
  })

  assert.equal(result.ok, true)

  const handler = handlers.get(`screen-translation:pin:${result.windowId}`)
  await handler?.(null, {
    type: 'content-bounds',
    x: 16,
    y: 20,
    width: 225,
    height: 85,
  })

  assert.deepEqual(geometryCalls, [
    ['setPosition', 110, 214],
    ['setSize', 237, 97],
  ])
})

test('pinTranslatedImage zooms around the pointer anchor and persists the resized content bounds on zoom end', async () => {
  const {
    pinTranslatedImage,
    attachPinnedRecord,
  } = loadPinWindowManager()
  const handlers = new Map()
  const geometryCalls = []
  const persistedBounds = []
  const windowInstance = {
    id: 1004,
    webContents: {
      executeJavaScript: async () => true,
    },
    isDestroyed: () => false,
    setPosition: (x, y) => geometryCalls.push(['setPosition', x, y]),
    setSize: (width, height) => geometryCalls.push(['setSize', width, height]),
  }
  const utools = {
    createBrowserWindow: (_url, _options, callback) => {
      queueMicrotask(() => callback?.())
      return windowInstance
    },
  }
  const electron = {
    ipcRenderer: {
      on: (channel, handler) => handlers.set(channel, handler),
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 50, y: 60, width: 200, height: 100 },
    persistRecordPinState: async (recordId, bounds) => {
      persistedBounds.push([recordId, bounds])
      return null
    },
  })

  assert.equal(result.ok, true)
  await attachPinnedRecord({
    windowId: result.windowId,
    recordId: 'record-zoom',
    persistRecordPinState: async (recordId, bounds) => {
      persistedBounds.push([recordId, bounds])
      return null
    },
  })

  geometryCalls.length = 0
  persistedBounds.length = 0

  const handler = handlers.get(`screen-translation:pin:${result.windowId}`)
  await handler?.(null, {
    type: 'zoom',
    phase: 'live',
    anchorRatioX: 0.25,
    anchorRatioY: 0.5,
    scaleFactor: 1.5,
  })

  assert.deepEqual(geometryCalls, [
    ['setPosition', 19, 29],
    ['setSize', 312, 162],
  ])
  assert.deepEqual(persistedBounds, [])

  await handler?.(null, {
    type: 'zoom',
    phase: 'end',
  })

  assert.deepEqual(persistedBounds, [
    ['record-zoom', { x: 25, y: 35, width: 300, height: 150 }],
  ])
})

test('pinTranslatedImage prefers a single setBounds update during live zoom when the runtime supports it', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  const handlers = new Map()
  const geometryCalls = []
  const windowInstance = {
    id: 1005,
    webContents: {
      executeJavaScript: async () => true,
    },
    isDestroyed: () => false,
    setBounds: (bounds, animate) => geometryCalls.push(['setBounds', bounds, animate]),
  }
  const utools = {
    createBrowserWindow: (_url, _options, callback) => {
      queueMicrotask(() => callback?.())
      return windowInstance
    },
  }
  const electron = {
    ipcRenderer: {
      on: (channel, handler) => handlers.set(channel, handler),
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 50, y: 60, width: 200, height: 100 },
  })

  assert.equal(result.ok, true)

  const handler = handlers.get(`screen-translation:pin:${result.windowId}`)
  await handler?.(null, {
    type: 'zoom',
    phase: 'live',
    anchorRatioX: 0.25,
    anchorRatioY: 0.5,
    scaleFactor: 1.5,
  })

  assert.deepEqual(geometryCalls, [
    ['setBounds', { x: 19, y: 29, width: 312, height: 162 }, false],
  ])
})

test('pinTranslatedImage focuses the pin window when the user clicks to start interacting with it', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  const handlers = new Map()
  const focusCalls = []
  const windowInstance = {
    id: 1006,
    webContents: {
      executeJavaScript: async () => true,
    },
    isDestroyed: () => false,
    focus: () => focusCalls.push('focus'),
  }
  const utools = {
    createBrowserWindow: (_url, _options, callback) => {
      queueMicrotask(() => callback?.())
      return windowInstance
    },
  }
  const electron = {
    ipcRenderer: {
      on: (channel, handler) => handlers.set(channel, handler),
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,original-image',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(result.ok, true)
  const handler = handlers.get(`screen-translation:pin:${result.windowId}`)
  await handler?.(null, {
    type: 'drag-start',
    screenX: 100,
    screenY: 200,
  })

  assert.deepEqual(focusCalls, ['focus'])
})
