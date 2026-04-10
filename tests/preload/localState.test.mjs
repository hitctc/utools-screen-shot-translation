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
  const credentialStoreModulePath = path.resolve('public/preload/translationCredentialStore.cjs')
  const customCaptureModulePath = path.resolve('public/preload/customCapture.cjs')
  const pinWindowManagerModulePath = path.resolve('public/preload/pinWindowManager.cjs')
  const recordStoreModulePath = path.resolve('public/preload/recordStore.cjs')
  delete require.cache[servicesModulePath]
  delete require.cache[credentialStoreModulePath]
  delete require.cache[customCaptureModulePath]
  delete require.cache[pinWindowManagerModulePath]
  delete require.cache[recordStoreModulePath]

  if (options.customCaptureModule) {
    require.cache[customCaptureModulePath] = {
      id: customCaptureModulePath,
      filename: customCaptureModulePath,
      loaded: true,
      exports: options.customCaptureModule,
    }
  }

  if (options.pinWindowManagerModule) {
    require.cache[pinWindowManagerModulePath] = {
      id: pinWindowManagerModulePath,
      filename: pinWindowManagerModulePath,
      loaded: true,
      exports: options.pinWindowManagerModule,
    }
  }

  if (options.recordStoreModule) {
    require.cache[recordStoreModulePath] = {
      id: recordStoreModulePath,
      filename: recordStoreModulePath,
      loaded: true,
      exports: options.recordStoreModule,
    }
  }

  const storage = new Map(Object.entries(initialStorage))
  let credentialDoc = options.translationCredentialDoc ?? null
  const notifications = []
  global.window = {
    utools: {
      showOpenDialog: options.showOpenDialog ?? (async () => []),
      createBrowserWindow: options.createBrowserWindow ?? (() => null),
      hideMainWindow: options.hideMainWindow ?? (() => true),
      showMainWindow: options.showMainWindow ?? (() => true),
      showNotification: options.showNotification ?? ((message) => notifications.push(message)),
      dbStorage: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null
        },
        setItem(key, value) {
          storage.set(key, value)
        },
      },
      db: {
        get(id) {
          return credentialDoc && credentialDoc._id === id ? credentialDoc : null
        },
        put(doc) {
          credentialDoc = {
            ...doc,
            _rev: options.translationCredentialRev ?? '2-rev',
          }

          return {
            ok: true,
            id: doc._id,
            rev: credentialDoc._rev,
          }
        },
      },
    },
  }

  require('../../public/preload/services.js')

  return {
    services: global.window.services,
    storage,
    notifications,
    getCredentialDoc() {
      return credentialDoc
    },
    cleanup() {
      delete global.window
      delete require.cache[servicesModulePath]
      delete require.cache[credentialStoreModulePath]
      delete require.cache[customCaptureModulePath]
      delete require.cache[pinWindowManagerModulePath]
      delete require.cache[recordStoreModulePath]
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
    'getTranslationCredentials',
    'getUiSettings',
    'listSavedRecords',
    'pickSaveDirectory',
    'repinSavedRecord',
    'runCaptureTranslationPin',
    'savePluginSettings',
    'saveTranslationCredentials',
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

test('repinSavedRecord keeps a bridge failure code from the pin manager', async () => {
  const { services, cleanup } = loadServicesWithStorage(
    {
      'screen-shot-translation-settings': {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: '/tmp/save',
        confirmBeforeDelete: true,
      },
    },
    {
      pinWindowManagerModule: {
        repinSavedRecordImage: async () => ({ ok: false, code: 'repin-failed' }),
      },
    },
  )

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

test('getTranslationCredentials reads the synced baidu credentials document', () => {
  const { services, cleanup } = loadServicesWithStorage(
    {},
    {
      translationCredentialDoc: {
        _id: 'screen-shot-translation/translation-credentials',
        _rev: '1-rev',
        appId: ' sync-app-id ',
        appKey: ' sync-app-key ',
      },
    },
  )

  assert.deepEqual(services.getTranslationCredentials(), {
    appId: 'sync-app-id',
    appKey: 'sync-app-key',
  })

  cleanup()
})

test('saveTranslationCredentials merges and persists the synced baidu credentials document', () => {
  const { services, getCredentialDoc, cleanup } = loadServicesWithStorage(
    {},
    {
      translationCredentialDoc: {
        _id: 'screen-shot-translation/translation-credentials',
        _rev: '1-rev',
        appId: 'existing-app-id',
        appKey: '',
      },
    },
  )

  const result = services.saveTranslationCredentials({
    appKey: ' sync-app-key ',
  })

  assert.deepEqual(result, {
    appId: 'existing-app-id',
    appKey: 'sync-app-key',
  })
  assert.deepEqual(getCredentialDoc(), {
    _id: 'screen-shot-translation/translation-credentials',
    _rev: '2-rev',
    appId: 'existing-app-id',
    appKey: 'sync-app-key',
    updatedAt: getCredentialDoc().updatedAt,
  })

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

test('repinSavedRecord keeps already pinned requests on the happy path and shows a notification', async () => {
  const { services, notifications, cleanup } = loadServicesWithStorage(
    {
      'screen-shot-translation-settings': {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: '/tmp/save',
        confirmBeforeDelete: true,
      },
    },
    {
      recordStoreModule: {
        getSavedRecord: async () => ({
          id: 'record-1',
          imageFilename: 'translated.png',
          lastPinBounds: { x: 10, y: 20, width: 120, height: 90 },
        }),
        listSavedRecords: async () => ({ records: [] }),
        deleteSavedRecord: async () => ({ records: [] }),
        saveTranslatedRecord: async () => null,
        updateSavedRecordPinState: async () => null,
      },
      pinWindowManagerModule: {
        repinSavedRecordImage: async () => ({ ok: true, code: 'already-pinned' }),
      },
    },
  )

  assert.deepEqual(await services.repinSavedRecord('record-1'), {
    ok: true,
    code: 'already-pinned',
  })
  assert.deepEqual(notifications, [])

  cleanup()
})

test('runCaptureTranslationPin starts the workflow after the custom capture bridge returns an image', async () => {
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
      customCaptureModule: {
        captureImageWithCustomOverlay: async () => ({
          ok: true,
          image: 'data:image/png;base64,abc123',
          bounds: { x: 12, y: 24, width: 180, height: 96 },
        }),
      },
      pinWindowManagerModule: {
        pinTranslatedImage: async () => ({ ok: false, code: 'pin-failed' }),
      },
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-config-invalid',
  })

  cleanup()
})

test('runCaptureTranslationPin keeps capture-cancelled when the custom capture bridge is cancelled', async () => {
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
      customCaptureModule: {
        captureImageWithCustomOverlay: async () => ({
          ok: false,
          code: 'capture-cancelled',
        }),
      },
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.deepEqual(result, {
    ok: false,
    code: 'capture-cancelled',
  })

  cleanup()
})
