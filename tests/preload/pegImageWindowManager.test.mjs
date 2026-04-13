import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

function loadPegWindowManager() {
  const modulePath = path.resolve('public/preload/pegImageWindowManager.cjs')
  delete require.cache[modulePath]
  return require('../../public/preload/pegImageWindowManager.cjs')
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

test('pegTranslatedImage keeps window bounds aligned with the real pegged content area', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
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

test('pegTranslatedImage defaults to top-left when no historical bounds exist', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,translated',
    bounds: null,
    persistRecordPegState: async () => null,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 6, y: 6, width: 80, height: 40 })
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 0,
      y: 0,
      width: 92,
      height: 52,
    },
  )
})

test('pegTranslatedImage converts hiDPI image pixels back to logical window bounds when opening from the run flow', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
  let capturedOptions = null
  const utools = {
    getCursorScreenPoint: () => ({ x: 10, y: 10 }),
    getDisplayNearestPoint: () => ({
      scaleFactor: 2,
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
    }),
    createBrowserWindow: (_url, options, callback) => {
      capturedOptions = options
      queueMicrotask(() => callback?.())
      return {
        id: 1007,
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
        getSize: () => ({ width: 200, height: 100 }),
        toBitmap: () => createBgraBitmap(200, 100, () => [255, 255, 255, 255]),
      }),
    },
  }

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,translated-hiDPI',
    bounds: null,
    persistRecordPegState: async () => null,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 6, y: 6, width: 100, height: 50 })
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 0,
      y: 0,
      width: 112,
      height: 62,
    },
  )
})

test('pegTranslatedImage preprocesses white-edge images before opening the peg window', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,source-image',
    bounds: { x: 100, y: 200, width: 120, height: 60 },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 140, y: 220, width: 40, height: 20 })
  assert.deepEqual(croppedRect, { x: 2, y: 2, width: 2, height: 2 })
  assert.match(executedScript, /cropped-image/)
  assert.deepEqual(
    {
      x: capturedOptions?.x,
      y: capturedOptions?.y,
      width: capturedOptions?.width,
      height: capturedOptions?.height,
    },
    {
      x: 134,
      y: 214,
      width: 52,
      height: 32,
    },
  )
})

test('repegSavedRecordImage keeps persisted content bounds stable while still reusing the cropped payload', async () => {
  const { repegSavedRecordImage } = loadPegWindowManager()
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
        id: 1011,
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
            toDataURL: () => 'data:image/png;base64,cropped-repeat-image',
          }
        },
      }),
    },
  }

  const result = await repegSavedRecordImage({
    utools,
    electron,
    record: {
      id: 'record-repeat',
      lastPegBounds: { x: 120, y: 210, width: 80, height: 40 },
    },
    imageSrc: 'data:image/png;base64,source-image',
    persistRecordPegState: async () => null,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.bounds, { x: 120, y: 210, width: 80, height: 40 })
  assert.deepEqual(croppedRect, { x: 2, y: 2, width: 2, height: 2 })
  assert.match(executedScript, /cropped-repeat-image/)
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

test('repegSavedRecordImage restores and focuses an already pegged window', async () => {
  const {
    pegTranslatedImage,
    attachPeggedRecord,
    repegSavedRecordImage,
  } = loadPegWindowManager()
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

  const openResult = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(openResult.ok, true)
  await attachPeggedRecord({
    windowId: openResult.windowId,
    recordId: 'record-1',
  })

  calls.length = 0

  const repegResult = await repegSavedRecordImage({
    utools,
    electron,
    record: {
      id: 'record-1',
      lastPegBounds: { x: 10, y: 20, width: 120, height: 90 },
    },
    imageSrc: 'file:///tmp/translated.png',
  })

  assert.deepEqual(repegResult, {
    ok: true,
    code: 'already-pegged',
  })
  assert.deepEqual(calls, [
    'restore',
    'show',
    'setAlwaysOnTop',
    'moveTop',
    'focus',
    'execute:window.__SCREEN_TRANSLATION_PEG_ATTENTION__?.()',
  ])
})

test('pegTranslatedImage shrinks the window directly to the reported content bounds while keeping the frame thickness', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 100, y: 200, width: 400, height: 120 },
  })

  assert.equal(result.ok, true)

  const handler = handlers.get(`screen-translation:peg:${result.windowId}`)
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

test('pegTranslatedImage zooms around the pointer anchor and persists the resized content bounds on zoom end', async () => {
  const {
    pegTranslatedImage,
    attachPeggedRecord,
  } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 50, y: 60, width: 200, height: 100 },
    persistRecordPegState: async (recordId, bounds) => {
      persistedBounds.push([recordId, bounds])
      return null
    },
  })

  assert.equal(result.ok, true)
  await attachPeggedRecord({
    windowId: result.windowId,
    recordId: 'record-zoom',
    persistRecordPegState: async (recordId, bounds) => {
      persistedBounds.push([recordId, bounds])
      return null
    },
  })

  geometryCalls.length = 0
  persistedBounds.length = 0

  const handler = handlers.get(`screen-translation:peg:${result.windowId}`)
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

test('pegTranslatedImage prefers a single setBounds update during live zoom when the runtime supports it', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 50, y: 60, width: 200, height: 100 },
  })

  assert.equal(result.ok, true)

  const handler = handlers.get(`screen-translation:peg:${result.windowId}`)
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

test('pegTranslatedImage focuses the peg window when the user clicks to start interacting with it', async () => {
  const { pegTranslatedImage } = loadPegWindowManager()
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

  const result = await pegTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,original-image',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(result.ok, true)
  const handler = handlers.get(`screen-translation:peg:${result.windowId}`)
  await handler?.(null, {
    type: 'drag-start',
    screenX: 100,
    screenY: 200,
  })

  assert.deepEqual(focusCalls, ['focus'])
})
