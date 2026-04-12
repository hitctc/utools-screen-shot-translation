import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const { captureImageWithCustomOverlay } = require('../../public/preload/customCapture.cjs')

function createIpcRendererMock() {
  const listeners = new Map()

  return {
    listeners,
    on(channel, listener) {
      listeners.set(channel, listener)
    },
    off(channel, listener) {
      const current = listeners.get(channel)
      if (!listener || current === listener) {
        listeners.delete(channel)
      }
    },
  }
}

test('captureImageWithCustomOverlay returns capture-cancelled when desktopCaptureSources is unavailable', async () => {
  const result = await captureImageWithCustomOverlay({
    utools: {
      createBrowserWindow() {
        throw new Error('should not create a capture window when screen source API is missing')
      },
      getCursorScreenPoint: () => ({ x: 1, y: 1 }),
      getDisplayNearestPoint: () => ({
        id: 1,
        scaleFactor: 2,
        bounds: { x: 0, y: 0, width: 1440, height: 900 },
      }),
    },
    electron: {
      ipcRenderer: createIpcRendererMock(),
    },
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'capture-cancelled',
  })
})

test('captureImageWithCustomOverlay injects the frozen screen image into the overlay and resolves submit payload directly', async () => {
  const ipcRenderer = createIpcRendererMock()
  const executedScripts = []
  let desktopCaptureCalls = 0
  const windowInstance = {
    id: 91,
    close() {},
    isDestroyed: () => false,
    setAlwaysOnTop() {},
    webContents: {
      async executeJavaScript(script) {
        executedScripts.push(script)
      },
    },
  }

  const capturePromise = captureImageWithCustomOverlay({
    utools: {
      desktopCaptureSources: async () => {
        desktopCaptureCalls += 1
        return [
          {
            display_id: '3',
            thumbnail: {
              toDataURL() {
                return 'data:image/png;base64,screen-thumb'
              },
            },
          },
        ]
      },
      createBrowserWindow(_url, _options, callback) {
        queueMicrotask(() => {
          callback?.()
        })
        return windowInstance
      },
      hideMainWindow: () => true,
      showMainWindow: () => true,
      getCursorScreenPoint: () => ({ x: 120, y: 240 }),
      getDisplayNearestPoint: () => ({
        id: 3,
        scaleFactor: 2,
        bounds: { x: 10, y: 20, width: 800, height: 600 },
      }),
    },
    electron: {
      ipcRenderer,
    },
    waitForMainWindowHide: async () => {},
    waitForStableCaptureFrame: async () => {},
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(executedScripts.length, 1)
  assert.match(executedScripts[0], /data:image\/png;base64,screen-thumb/)
  assert.equal(desktopCaptureCalls, 2)

  const listener = ipcRenderer.listeners.get('screen-translation:capture:91')
  assert.equal(typeof listener, 'function')
  listener?.({}, {
    type: 'submit',
    bounds: { x: 40, y: 60, width: 200, height: 100 },
    image: 'data:image/png;base64,selection',
  })

  const result = await capturePromise

  assert.deepEqual(result, {
    ok: true,
    image: 'data:image/png;base64,selection',
    bounds: { x: 40, y: 60, width: 200, height: 100 },
  })
  assert.equal(desktopCaptureCalls, 2)
})

test('captureImageWithCustomOverlay only calls outPlugin for detach windows and samples before opening the overlay', async () => {
  const ipcRenderer = createIpcRendererMock()
  const steps = []
  const releaseHideWaits = []
  const windowInstance = {
    id: 37,
    close() {},
    isDestroyed: () => false,
    setAlwaysOnTop() {},
    webContents: {
      async executeJavaScript() {},
    },
  }

  const capturePromise = captureImageWithCustomOverlay({
    utools: {
      getWindowType: () => 'detach',
      desktopCaptureSources: async () => [
        ...(() => {
          steps.push('capture-screen-source')
          return [
            {
              display_id: '9',
              thumbnail: {
                toDataURL() {
                  return 'data:image/png;base64,screen-thumb'
                },
              },
            },
          ]
        })(),
      ],
      createBrowserWindow(_url, _options, callback) {
        steps.push('create-overlay')
        queueMicrotask(() => {
          callback?.()
        })
        return windowInstance
      },
      outPlugin() {
        steps.push('out-plugin')
        return true
      },
      showMainWindow() {
        steps.push('show-main-window')
      },
      getCursorScreenPoint: () => ({ x: 40, y: 60 }),
      getDisplayNearestPoint: () => ({
        id: 9,
        scaleFactor: 2,
        bounds: { x: 0, y: 0, width: 1200, height: 900 },
      }),
    },
    electron: {
      ipcRenderer,
    },
    waitForMainWindowHide() {
      steps.push('wait-hide')
      return new Promise((resolve) => {
        releaseHideWaits.push(() => {
          steps.push('wait-hide-resolved')
          resolve()
        })
      })
    },
    waitForStableCaptureFrame: async () => {
      steps.push('wait-stable-frame')
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(steps, ['out-plugin', 'wait-hide'])

  releaseHideWaits.shift()?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(steps, [
    'out-plugin',
    'wait-hide',
    'wait-hide-resolved',
    'capture-screen-source',
    'wait-stable-frame',
    'capture-screen-source',
    'create-overlay',
  ])

  const listener = ipcRenderer.listeners.get('screen-translation:capture:37')
  listener?.({}, {
    type: 'submit',
    bounds: { x: 10, y: 20, width: 30, height: 40 },
    image: 'data:image/png;base64,selection',
  })

  const result = await capturePromise

  assert.deepEqual(result, {
    ok: true,
    image: 'data:image/png;base64,selection',
    bounds: { x: 10, y: 20, width: 30, height: 40 },
  })
  assert.deepEqual(steps, [
    'out-plugin',
    'wait-hide',
    'wait-hide-resolved',
    'capture-screen-source',
    'wait-stable-frame',
    'capture-screen-source',
    'create-overlay',
  ])
})

test('captureImageWithCustomOverlay falls back to hideMainWindow for main windows and does not re-sample after submit', async () => {
  const ipcRenderer = createIpcRendererMock()
  const steps = []
  const releaseHideWaits = []
  const windowInstance = {
    id: 51,
    close() {},
    isDestroyed: () => false,
    setAlwaysOnTop() {},
    webContents: {
      async executeJavaScript() {},
    },
  }

  const capturePromise = captureImageWithCustomOverlay({
    utools: {
      getWindowType: () => 'main',
      hideMainWindow() {
        steps.push('hide-main-window')
        return true
      },
      desktopCaptureSources: async () => [
        ...(() => {
          steps.push('capture-screen-source')
          return [
            {
              display_id: '11',
              thumbnail: {
                toDataURL() {
                  return 'data:image/png;base64,screen-thumb'
                },
              },
            },
          ]
        })(),
      ],
      createBrowserWindow(_url, _options, callback) {
        steps.push('create-overlay')
        queueMicrotask(() => {
          callback?.()
        })
        return windowInstance
      },
      showMainWindow() {
        steps.push('show-main-window')
      },
      getCursorScreenPoint: () => ({ x: 1, y: 2 }),
      getDisplayNearestPoint: () => ({
        id: 11,
        scaleFactor: 2,
        bounds: { x: 0, y: 0, width: 1000, height: 700 },
      }),
    },
    electron: {
      ipcRenderer,
    },
    waitForMainWindowHide() {
      steps.push('wait-hide')
      return new Promise((resolve) => {
        releaseHideWaits.push(() => {
          steps.push('wait-hide-resolved')
          resolve()
        })
      })
    },
    waitForStableCaptureFrame: async () => {
      steps.push('wait-stable-frame')
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(steps, ['hide-main-window', 'wait-hide'])

  releaseHideWaits.shift()?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(steps, [
    'hide-main-window',
    'wait-hide',
    'wait-hide-resolved',
    'capture-screen-source',
    'wait-stable-frame',
    'capture-screen-source',
    'create-overlay',
  ])

  const listener = ipcRenderer.listeners.get('screen-translation:capture:51')
  listener?.({}, {
    type: 'submit',
    bounds: { x: 5, y: 6, width: 7, height: 8 },
    image: 'data:image/png;base64,selection',
  })

  const result = await capturePromise

  assert.deepEqual(result, {
    ok: true,
    image: 'data:image/png;base64,selection',
    bounds: { x: 5, y: 6, width: 7, height: 8 },
  })
  assert.deepEqual(steps, [
    'hide-main-window',
    'wait-hide',
    'wait-hide-resolved',
    'capture-screen-source',
    'wait-stable-frame',
    'capture-screen-source',
    'create-overlay',
  ])
})

test('captureImageWithCustomOverlay waits for a stable frozen frame before opening the overlay', async () => {
  const ipcRenderer = createIpcRendererMock()
  const injectedScripts = []
  const sampledFrames = [
    'data:image/png;base64,frame-1',
    'data:image/png;base64,frame-2',
    'data:image/png;base64,frame-2',
  ]
  const windowInstance = {
    id: 72,
    close() {},
    isDestroyed: () => false,
    setAlwaysOnTop() {},
    webContents: {
      async executeJavaScript(script) {
        injectedScripts.push(script)
      },
    },
  }

  const capturePromise = captureImageWithCustomOverlay({
    utools: {
      hideMainWindow: () => true,
      desktopCaptureSources: async () => [
        {
          display_id: '4',
          thumbnail: {
            toDataURL() {
              return sampledFrames.shift() || 'data:image/png;base64,frame-2'
            },
          },
        },
      ],
      createBrowserWindow(_url, _options, callback) {
        queueMicrotask(() => {
          callback?.()
        })
        return windowInstance
      },
      getCursorScreenPoint: () => ({ x: 4, y: 5 }),
      getDisplayNearestPoint: () => ({
        id: 4,
        scaleFactor: 2,
        bounds: { x: 0, y: 0, width: 1440, height: 900 },
      }),
    },
    electron: {
      ipcRenderer,
    },
    waitForMainWindowHide: async () => {},
    waitForStableCaptureFrame: async () => {},
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(injectedScripts.length, 1)
  assert.match(injectedScripts[0], /data:image\/png;base64,frame-2/)

  const listener = ipcRenderer.listeners.get('screen-translation:capture:72')
  listener?.({}, {
    type: 'submit',
    bounds: { x: 8, y: 9, width: 10, height: 11 },
    image: 'data:image/png;base64,selection',
  })

  await assert.doesNotReject(() => capturePromise)
})
