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

function loadServicesWithStorage(initialStorage = {}, options = {}) {
  const servicesModulePath = path.resolve('public/preload/services.js')
  delete require.cache[servicesModulePath]

  const storage = new Map(Object.entries(initialStorage))
  global.window = {
    utools: {
      showOpenDialog: options.showOpenDialog ?? (async () => []),
      screenCapture: options.screenCapture ?? ((callback) => callback('')),
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

test('normalizePluginSettings keeps plugin defaults stable', () => {
  assert.deepEqual(normalizePluginSettings({}), {
    translationMode: 'auto',
    saveTranslatedImage: false,
    saveDirectory: '',
    confirmBeforeDelete: true,
  })
})

test('normalizePluginSettings sanitizes invalid values with strict booleans', () => {
  assert.deepEqual(
    normalizePluginSettings({
      translationMode: 'ja-to-en',
      saveTranslatedImage: 'false',
      saveDirectory: 42,
      confirmBeforeDelete: 'no',
    }),
    {
      translationMode: 'auto',
      saveTranslatedImage: false,
      saveDirectory: '',
      confirmBeforeDelete: true,
    },
  )
})

test('normalizePluginSettings preserves supported translation mode and trims save directory', () => {
  assert.deepEqual(
    normalizePluginSettings({
      translationMode: 'en-to-zh',
      saveTranslatedImage: true,
      saveDirectory: ' /tmp/export ',
      confirmBeforeDelete: false,
    }),
    {
      translationMode: 'en-to-zh',
      saveTranslatedImage: true,
      saveDirectory: '/tmp/export',
      confirmBeforeDelete: false,
    },
  )
})

test('services exposes the plugin settings and record store bridge', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.deepEqual(Object.keys(services).sort(), [
    'deleteSavedRecord',
    'getPluginSettings',
    'getUiSettings',
    'listSavedRecords',
    'pickSaveDirectory',
    'repinSavedRecord',
    'runCaptureTranslationPin',
    'savePluginSettings',
    'saveUiSettings',
  ])

  cleanup()
})

test('pickSaveDirectory returns the first selected directory or an empty string', async () => {
  const { services, cleanup } = loadServicesWithStorage(
    {},
    {
      showOpenDialog: async () => ['/tmp/export', '/tmp/ignored'],
    },
  )

  assert.equal(await services.pickSaveDirectory(), '/tmp/export')

  cleanup()
})

test('pickSaveDirectory returns an empty string when the dialog is cancelled', async () => {
  const { services, cleanup } = loadServicesWithStorage(
    {},
    {
      showOpenDialog: async () => [],
    },
  )

  assert.equal(await services.pickSaveDirectory(), '')

  cleanup()
})

test('repinSavedRecord returns the honest failure contract', async () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.deepEqual(await services.repinSavedRecord('record-1'), {
    ok: false,
    code: 'repin-failed',
  })

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
      translationMode: 'en-to-zh',
      saveTranslatedImage: 'false',
      saveDirectory: ' /tmp/translated ',
      confirmBeforeDelete: 'no',
    },
  })

  assert.deepEqual(services.getPluginSettings(), {
    translationMode: 'en-to-zh',
    saveTranslatedImage: false,
    saveDirectory: '/tmp/translated',
    confirmBeforeDelete: true,
  })

  cleanup()
})

test('savePluginSettings normalizes and persists the new plugin settings payload', () => {
  const { services, storage, cleanup } = loadServicesWithStorage()

  const result = services.savePluginSettings({
    translationMode: 'zh-to-en',
    saveTranslatedImage: true,
    saveDirectory: ' /tmp/save ',
    confirmBeforeDelete: false,
  })

  assert.deepEqual(result, {
    translationMode: 'zh-to-en',
    saveTranslatedImage: true,
    saveDirectory: '/tmp/save',
    confirmBeforeDelete: false,
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})

test('savePluginSettings merges a valid partial update without clearing other fields', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'en-to-zh',
      saveTranslatedImage: true,
      saveDirectory: '/tmp/cache',
      confirmBeforeDelete: true,
    },
  })

  const result = services.savePluginSettings({
    saveDirectory: ' /tmp/archive ',
  })

  assert.deepEqual(result, {
    translationMode: 'en-to-zh',
    saveTranslatedImage: true,
    saveDirectory: '/tmp/archive',
    confirmBeforeDelete: true,
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})

test('savePluginSettings keeps existing translation mode when partial value is invalid', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'en-to-zh',
      saveTranslatedImage: false,
      saveDirectory: '/tmp/cache',
      confirmBeforeDelete: true,
    },
  })

  const result = services.savePluginSettings({
    translationMode: 'bad',
  })

  assert.deepEqual(result, {
    translationMode: 'en-to-zh',
    saveTranslatedImage: false,
    saveDirectory: '/tmp/cache',
    confirmBeforeDelete: true,
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})

test('savePluginSettings keeps existing save directory when partial value is not a string', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'zh-to-en',
      saveTranslatedImage: true,
      saveDirectory: '/tmp/export',
      confirmBeforeDelete: false,
    },
  })

  const result = services.savePluginSettings({
    saveDirectory: 42,
  })

  assert.deepEqual(result, {
    translationMode: 'zh-to-en',
    saveTranslatedImage: true,
    saveDirectory: '/tmp/export',
    confirmBeforeDelete: false,
  })
  assert.deepEqual(storage.get('screen-shot-translation-settings'), result)

  cleanup()
})

test('runCaptureTranslationPin returns save-config-invalid when the persisted save directory is empty', async () => {
  const { services, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: '',
      confirmBeforeDelete: true,
    },
  })

  const result = await services.runCaptureTranslationPin()

  assert.deepEqual(result, {
    ok: false,
    code: 'save-config-invalid',
  })

  cleanup()
})

test('runCaptureTranslationPin starts the workflow after screenCapture returns an image', async () => {
  const { services, cleanup } = loadServicesWithStorage(
    {
      'screen-shot-translation-settings': {
        translationMode: 'auto',
        saveTranslatedImage: false,
        saveDirectory: '',
        confirmBeforeDelete: true,
      },
    },
    {
      screenCapture: (callback) => callback('data:image/png;base64,abc123'),
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-failed',
  })

  cleanup()
})

test('runCaptureTranslationPin keeps capture-cancelled when screenCapture returns an empty image', async () => {
  const { services, cleanup } = loadServicesWithStorage(
    {
      'screen-shot-translation-settings': {
        translationMode: 'auto',
        saveTranslatedImage: false,
        saveDirectory: '',
        confirmBeforeDelete: true,
      },
    },
    {
      screenCapture: (callback) => callback(''),
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.deepEqual(result, {
    ok: false,
    code: 'capture-cancelled',
  })

  cleanup()
})
