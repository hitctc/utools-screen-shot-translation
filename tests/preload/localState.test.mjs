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

test('services only exposes the current plugin setting APIs', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.deepEqual(Object.keys(services).sort(), [
    'getPluginSettings',
    'getUiSettings',
    'savePluginSettings',
    'saveUiSettings',
  ])

  cleanup()
})

test('getUiSettings reads normalized values from storage', () => {
  const { services, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-ui-settings': {
      themeMode: 'dark',
      windowHeight: 1200,
    },
  })

  assert.deepEqual(services.getUiSettings(), {
    themeMode: 'dark',
    windowHeight: 960,
  })

  cleanup()
})

test('saveUiSettings merges partial updates with the persisted ui settings', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-ui-settings': {
      themeMode: 'light',
      windowHeight: 720,
    },
  })

  const result = services.saveUiSettings({
    windowHeight: 300,
  })

  assert.deepEqual(result, {
    themeMode: 'light',
    windowHeight: 480,
  })
  assert.deepEqual(storage.get('screen-shot-translation-ui-settings'), result)

  cleanup()
})

test('getPluginSettings reads normalized values from storage', () => {
  const { services, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      sourceLanguage: ' en ',
      targetLanguage: 'ja',
      pinPreviewMode: 'floating',
    },
  })

  assert.deepEqual(services.getPluginSettings(), {
    sourceLanguage: 'en',
    targetLanguage: 'ja',
    pinPreviewMode: 'overlay',
  })

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

test('savePluginSettings keeps persisted fields when only one field is updated', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      sourceLanguage: 'en',
      targetLanguage: 'ja',
      pinPreviewMode: 'side-by-side',
    },
  })

  const result = services.savePluginSettings({
    targetLanguage: ' fr ',
  })

  assert.deepEqual(result, {
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    pinPreviewMode: 'side-by-side',
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})
