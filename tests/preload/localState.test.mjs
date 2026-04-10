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
  const servicesModulePath = path.resolve('public/preload/services.js')
  delete require.cache[servicesModulePath]

  global.window = {
    utools: {
      dbStorage: {
        getItem() {
          return null
        },
        setItem() {},
      },
    },
  }

  require('../../public/preload/services.js')

  assert.equal(typeof global.window.services.getUiSettings, 'function')
  assert.equal(typeof global.window.services.saveUiSettings, 'function')
  assert.equal(typeof global.window.services.getPluginSettings, 'function')
  assert.equal(typeof global.window.services.savePluginSettings, 'function')

  assert.equal(typeof global.window.services.getBookmarkSettings, 'function')
  assert.equal(typeof global.window.services.saveBookmarkSettings, 'function')
  assert.equal(typeof global.window.services.resetBookmarkSettings, 'function')
  assert.equal(typeof global.window.services.getBookmarkCache, 'function')
  assert.equal(typeof global.window.services.saveBookmarkCache, 'function')
  assert.equal(typeof global.window.services.clearBookmarkCache, 'function')
  assert.equal(typeof global.window.services.getBookmarkUiSettings, 'function')
  assert.equal(typeof global.window.services.saveBookmarkUiSettings, 'function')
  assert.equal(typeof global.window.services.getPinnedBookmarks, 'function')
  assert.equal(typeof global.window.services.togglePinnedBookmarkState, 'function')
  assert.equal(typeof global.window.services.getRecentOpenedBookmarks, 'function')
  assert.equal(typeof global.window.services.openBookmarkUrl, 'function')
  assert.equal(typeof global.window.services.loadChromeBookmarks, 'function')

  delete global.window
  delete require.cache[servicesModulePath]
})
