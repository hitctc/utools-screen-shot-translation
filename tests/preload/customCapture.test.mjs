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

test('captureImageWithCustomOverlay injects the screen thumbnail into the overlay and resolves submit payload', async () => {
  const ipcRenderer = createIpcRendererMock()
  const executedScripts = []
  const windowInstance = {
    id: 91,
    close() {},
    isDestroyed: () => false,
    webContents: {
      async executeJavaScript(script) {
        executedScripts.push(script)
      },
    },
  }

  const capturePromise = captureImageWithCustomOverlay({
    utools: {
      desktopCaptureSources: async () => [
        {
          display_id: '3',
          thumbnail: {
            toDataURL() {
              return 'data:image/png;base64,screen-thumb'
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
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(executedScripts.length, 1)
  assert.match(executedScripts[0], /data:image\/png;base64,screen-thumb/)

  const listener = ipcRenderer.listeners.get('screen-translation:capture:91')
  assert.equal(typeof listener, 'function')
  listener?.({}, {
    type: 'submit',
    image: 'data:image/png;base64,selection',
    bounds: { x: 40, y: 60, width: 200, height: 100 },
  })

  const result = await capturePromise

  assert.deepEqual(result, {
    ok: true,
    image: 'data:image/png;base64,selection',
    bounds: { x: 40, y: 60, width: 200, height: 100 },
  })
})
