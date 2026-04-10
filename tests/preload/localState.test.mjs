import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const {
  DEFAULT_UI_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  normalizeUiSettings,
  normalizePluginSettings,
} = require('../../public/preload/localState.cjs')

function loadServicesWithStorage(initialStorage = {}) {
  const servicesModulePath = path.resolve('public/preload/services.js')
  delete require.cache[servicesModulePath]

  const storage = new Map(Object.entries(initialStorage))
  global.window = {
    utools: {
      dbStorage: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null
        },
        setItem(key, value) {
          storage.set(key, value)
        },
      },
      shellOpenExternal() {},
    },
  }

  require('../../public/preload/services.js')

  return {
    services: global.window.services,
    storage,
    cleanup() {
      delete global.window
      delete require.cache[servicesModulePath]
    },
  }
}

test('normalizeUiSettings falls back to default theme and window height', () => {
  assert.deepEqual(normalizeUiSettings({}), DEFAULT_UI_SETTINGS)
})

test('normalizeUiSettings keeps supported theme modes and clamps window height', () => {
  assert.deepEqual(
    normalizeUiSettings({
      themeMode: 'dark',
      windowHeight: 240,
    }),
    {
      themeMode: 'dark',
      windowHeight: 480,
    },
  )

  assert.deepEqual(
    normalizeUiSettings({
      themeMode: 'light',
      windowHeight: 1200,
    }),
    {
      themeMode: 'light',
      windowHeight: 960,
    },
  )
})

test('normalizePluginSettings keeps language and preview defaults stable', () => {
  assert.deepEqual(normalizePluginSettings({}), DEFAULT_PLUGIN_SETTINGS)
})

test('normalizePluginSettings trims language values and rejects invalid preview mode', () => {
  assert.deepEqual(
    normalizePluginSettings({
      sourceLanguage: ' en ',
      targetLanguage: ' ja ',
      pinPreviewMode: 'floating',
    }),
    {
      sourceLanguage: 'en',
      targetLanguage: 'ja',
      pinPreviewMode: 'overlay',
    },
  )
})

test('normalizePluginSettings preserves supported preview mode and fills missing languages', () => {
  assert.deepEqual(
    normalizePluginSettings({
      sourceLanguage: '   ',
      pinPreviewMode: 'side-by-side',
    }),
    {
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      pinPreviewMode: 'side-by-side',
    },
  )
})

test('services keeps legacy preload methods during the Task 3 to Task 4 transition', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.equal(typeof services.getUiSettings, 'function')
  assert.equal(typeof services.saveUiSettings, 'function')
  assert.equal(typeof services.getPluginSettings, 'function')
  assert.equal(typeof services.savePluginSettings, 'function')

  assert.equal(typeof services.getBookmarkSettings, 'function')
  assert.equal(typeof services.saveBookmarkSettings, 'function')
  assert.equal(typeof services.resetBookmarkSettings, 'function')
  assert.equal(typeof services.getBookmarkCache, 'function')
  assert.equal(typeof services.saveBookmarkCache, 'function')
  assert.equal(typeof services.clearBookmarkCache, 'function')
  assert.equal(typeof services.getBookmarkUiSettings, 'function')
  assert.equal(typeof services.saveBookmarkUiSettings, 'function')
  assert.equal(typeof services.getPinnedBookmarks, 'function')
  assert.equal(typeof services.togglePinnedBookmarkState, 'function')
  assert.equal(typeof services.getRecentOpenedBookmarks, 'function')
  assert.equal(typeof services.openBookmarkUrl, 'function')
  assert.equal(typeof services.loadChromeBookmarks, 'function')

  cleanup()
})

test('legacy saveBookmarkUiSettings reflects the toggled values in its return payload', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.deepEqual(
    services.saveBookmarkUiSettings({
      showRecentOpened: false,
      showOpenCount: false,
    }),
    {
      showRecentOpened: false,
      showOpenCount: false,
      themeMode: 'system',
      windowHeight: 640,
    },
  )

  cleanup()
})

test('loadChromeBookmarks throws a controlled transition error', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.throws(
    () => services.loadChromeBookmarks('/tmp/bookmarks'),
    /旧书签预加载桥接已停用/,
  )

  cleanup()
})

test('savePluginSettings normalizes and persists the new plugin settings payload', () => {
  const { services, storage, cleanup } = loadServicesWithStorage()

  const result = services.savePluginSettings({
    sourceLanguage: ' en ',
    targetLanguage: '   ',
    pinPreviewMode: 'floating',
  })

  assert.deepEqual(result, {
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    pinPreviewMode: 'overlay',
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})
