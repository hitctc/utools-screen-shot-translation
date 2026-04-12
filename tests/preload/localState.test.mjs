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
  const baiduPictureTranslateModulePath = path.resolve('public/preload/baiduPictureTranslate.cjs')
  const credentialStoreModulePath = path.resolve('public/preload/translationCredentialStore.cjs')
  const pinWindowManagerModulePath = path.resolve('public/preload/pinWindowManager.cjs')
  const recordStoreModulePath = path.resolve('public/preload/recordStore.cjs')
  delete require.cache[servicesModulePath]
  delete require.cache[baiduPictureTranslateModulePath]
  delete require.cache[credentialStoreModulePath]
  delete require.cache[pinWindowManagerModulePath]
  delete require.cache[recordStoreModulePath]

  if (Object.prototype.hasOwnProperty.call(options, 'baiduPictureTranslateModule')) {
    require.cache[baiduPictureTranslateModulePath] = {
      id: baiduPictureTranslateModulePath,
      filename: baiduPictureTranslateModulePath,
      loaded: true,
      exports: options.baiduPictureTranslateModule,
    }
  }

  if (Object.prototype.hasOwnProperty.call(options, 'pinWindowManagerModule')) {
    require.cache[pinWindowManagerModulePath] = {
      id: pinWindowManagerModulePath,
      filename: pinWindowManagerModulePath,
      loaded: true,
      exports: options.pinWindowManagerModule,
    }
  }

  if (Object.prototype.hasOwnProperty.call(options, 'recordStoreModule')) {
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
  const openedPaths = []
  const revealedPaths = []
  let outPluginCalls = 0
  let showMainWindowCalls = 0
  let pluginEnterHandler = null
  global.window = {
    utools: {
      onPluginEnter: options.onPluginEnter ?? ((handler) => {
        pluginEnterHandler = handler
      }),
      getWindowType: Object.prototype.hasOwnProperty.call(options, 'getWindowType')
        ? options.getWindowType
        : (() => 'main'),
      outPlugin: Object.prototype.hasOwnProperty.call(options, 'outPlugin')
        ? options.outPlugin
        : (() => {
            outPluginCalls += 1
            return true
          }),
      showOpenDialog: options.showOpenDialog ?? (async () => []),
      shellOpenPath: options.shellOpenPath ?? ((fullPath) => openedPaths.push(fullPath)),
      shellShowItemInFolder: options.shellShowItemInFolder ?? ((fullPath) => revealedPaths.push(fullPath)),
      screenCapture: options.screenCapture ?? ((callback) => callback('')),
      hideMainWindow: options.hideMainWindow ?? (() => true),
      showMainWindow: options.showMainWindow ?? (() => {
        showMainWindowCalls += 1
        return true
      }),
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
    openedPaths,
    revealedPaths,
    getCredentialDoc() {
      return credentialDoc
    },
    triggerPluginEnter(event) {
      pluginEnterHandler?.(event)
    },
    getOutPluginCalls() {
      return outPluginCalls
    },
    getShowMainWindowCalls() {
      return showMainWindowCalls
    },
    cleanup() {
      delete global.window
      delete require.cache[servicesModulePath]
      delete require.cache[baiduPictureTranslateModulePath]
      delete require.cache[credentialStoreModulePath]
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
      recordsColumnCount: 9,
    }),
    {
      themeMode: 'dark',
      windowHeight: 480,
      recordsColumnCount: 6,
    },
  )

  assert.deepEqual(
    normalizeUiSettings({
      themeMode: 'light',
      windowHeight: 1200,
      recordsColumnCount: 2,
    }),
    {
      themeMode: 'light',
      windowHeight: 960,
      recordsColumnCount: 3,
    },
  )
})

test('normalizePluginSettings keeps plugin defaults stable', () => {
  assert.deepEqual(normalizePluginSettings({}), DEFAULT_PLUGIN_SETTINGS)
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

test('services exposes the settings and official screenshot bridge', () => {
  const { services, cleanup } = loadServicesWithStorage()

  assert.deepEqual(Object.keys(services).sort(), [
    'concealPluginWindow',
    'consumePendingPluginEnter',
    'consumePendingWorkflowResult',
    'deleteSavedRecord',
    'getLastTranslationDebug',
    'getPluginSettings',
    'getTranslationCredentials',
    'getUiSettings',
    'listSavedRecords',
    'openExternalLink',
    'openSaveDirectory',
    'pickSaveDirectory',
    'repinSavedRecord',
    'runCaptureTranslationPin',
    'savePluginSettings',
    'saveTranslationCredentials',
    'saveUiSettings',
  ])

  cleanup()
})

test('preload plugin enter 只缓存 run 事件，不再额外隐藏主窗口', async () => {
  let hideMainWindowCalls = 0
  const { services, triggerPluginEnter, getOutPluginCalls, cleanup } = loadServicesWithStorage(
    {},
    {
      getWindowType: () => 'main',
      screenCapture: (callback) => callback(''),
      hideMainWindow: () => {
        hideMainWindowCalls += 1
        return true
      },
    },
  )

  triggerPluginEnter({ code: 'screen-shot-translation-run' })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(hideMainWindowCalls, 0)
  assert.equal(getOutPluginCalls(), 0)
  assert.deepEqual(services.consumePendingPluginEnter(), { code: 'screen-shot-translation-run' })
  assert.equal(services.consumePendingPluginEnter(), null)

  cleanup()
})

test('preload run 入口会直接启动 workflow，并把失败结果缓存给渲染层', async () => {
  let screenCaptureCalls = 0
  const { services, triggerPluginEnter, getShowMainWindowCalls, cleanup } = loadServicesWithStorage(
    {},
    {
      screenCapture: (callback) => {
        screenCaptureCalls += 1
        callback('data:image/png;base64,abc123')
      },
      baiduPictureTranslateModule: {
        translateCapturedImage: async () => ({
          ok: false,
          code: 'translation-failed',
        }),
        getLastTranslationDebug: () => null,
      },
    },
  )

  triggerPluginEnter({ code: 'screen-shot-translation-run' })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(screenCaptureCalls, 1)
  assert.equal(getShowMainWindowCalls(), 1)
  assert.deepEqual(services.consumePendingPluginEnter(), { code: 'screen-shot-translation-run' })
  assert.deepEqual(services.consumePendingWorkflowResult(), {
    ok: false,
    code: 'translation-failed',
    translationDebug: null,
  })
  assert.equal(services.consumePendingWorkflowResult(), null)

  cleanup()
})

test('preload plugin enter keeps records entry visible and only caches the event', () => {
  let hideMainWindowCalls = 0
  const { services, triggerPluginEnter, cleanup } = loadServicesWithStorage(
    {},
    {
      hideMainWindow: () => {
        hideMainWindowCalls += 1
        return true
      },
    },
  )

  triggerPluginEnter({ code: 'screen-shot-translation-records' })

  assert.equal(hideMainWindowCalls, 0)
  assert.deepEqual(services.consumePendingPluginEnter(), { code: 'screen-shot-translation-records' })

  cleanup()
})

test('openExternalLink prefers electron shell openExternal for https urls', async () => {
  const { services, cleanup } = loadServicesWithStorage()
  const openedUrls = []

  assert.equal(
    await services.openExternalLink('https://fanyi-api.baidu.com/product/233', {
      electron: {
        shell: {
          openExternal: async (url) => {
            openedUrls.push(url)
            return true
          },
        },
      },
    }),
    true,
  )

  assert.deepEqual(openedUrls, ['https://fanyi-api.baidu.com/product/233'])

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

test('openSaveDirectory prefers electron shell openPath when runtime shell is injected', async () => {
  const { services, openedPaths, revealedPaths, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: ' /tmp/export ',
      confirmBeforeDelete: true,
    },
  })

  const electronCalls = []

  assert.equal(
    await services.openSaveDirectory({
      electron: {
        shell: {
          openPath: async (fullPath) => {
            electronCalls.push(fullPath)
            return ''
          },
        },
      },
    }),
    true,
  )

  assert.deepEqual(electronCalls, ['/tmp/export'])
  assert.deepEqual(openedPaths, [])
  assert.deepEqual(revealedPaths, [])

  cleanup()
})

test('openSaveDirectory falls back to electron shell showItemInFolder when openPath reports an error', async () => {
  const { services, openedPaths, revealedPaths, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: ' /tmp/export ',
      confirmBeforeDelete: true,
    },
  })

  const electronCalls = []

  assert.equal(
    await services.openSaveDirectory({
      electron: {
        shell: {
          openPath: async () => 'failed',
          showItemInFolder: (fullPath) => {
            electronCalls.push(fullPath)
          },
        },
      },
    }),
    true,
  )

  assert.deepEqual(electronCalls, ['/tmp/export'])
  assert.deepEqual(revealedPaths, [])
  assert.deepEqual(openedPaths, [])

  cleanup()
})

test('openSaveDirectory falls back to utools shellOpenPath when electron shell is unavailable', async () => {
  const { services, openedPaths, revealedPaths, cleanup } = loadServicesWithStorage(
    {
      'screen-shot-translation-settings': {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: ' /tmp/export ',
        confirmBeforeDelete: true,
      },
    },
    {
      shellShowItemInFolder: undefined,
    },
  )

  delete global.window.utools.shellShowItemInFolder

  assert.equal(await services.openSaveDirectory({ electron: null }), true)
  assert.deepEqual(revealedPaths, [])
  assert.deepEqual(openedPaths, ['/tmp/export'])

  cleanup()
})

test('openSaveDirectory returns false when save directory is empty', async () => {
  const { services, openedPaths, revealedPaths, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: '   ',
      confirmBeforeDelete: true,
    },
  })

  assert.equal(await services.openSaveDirectory(), false)
  assert.deepEqual(openedPaths, [])
  assert.deepEqual(revealedPaths, [])

  cleanup()
})

test('openSaveDirectory shows a notification when every open strategy is unavailable', async () => {
  const { services, notifications, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-settings': {
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: '/tmp/export',
      confirmBeforeDelete: true,
    },
  })

  delete global.window.utools.shellOpenPath
  delete global.window.utools.shellShowItemInFolder

  assert.equal(await services.openSaveDirectory({ electron: null }), false)
  assert.deepEqual(notifications, ['打开保存目录失败，请检查目录路径是否有效。'])

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
      recordsColumnCount: 5,
    },
  })

  assert.deepEqual(services.getUiSettings(), {
    themeMode: 'dark',
    windowHeight: 960,
    recordsColumnCount: 5,
  })

  cleanup()
})

test('saveUiSettings merges partial updates with the persisted ui settings', () => {
  const { services, storage, cleanup } = loadServicesWithStorage({
    'screen-shot-translation-ui-settings': {
      themeMode: 'light',
      windowHeight: 720,
      recordsColumnCount: 3,
    },
  })

  const result = services.saveUiSettings({
    windowHeight: 300,
    recordsColumnCount: 6,
  })

  assert.deepEqual(result, {
    themeMode: 'light',
    windowHeight: 480,
    recordsColumnCount: 6,
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
        accessToken: ' sync-access-token ',
      },
    },
  )

  assert.deepEqual(services.getTranslationCredentials(), {
    appId: 'sync-app-id',
    accessToken: 'sync-access-token',
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
        accessToken: '',
      },
    },
  )

  const result = services.saveTranslationCredentials({
    accessToken: ' sync-access-token ',
  })

  assert.deepEqual(result, {
    appId: 'existing-app-id',
    accessToken: 'sync-access-token',
  })
  assert.deepEqual(getCredentialDoc(), {
    _id: 'screen-shot-translation/translation-credentials',
    _rev: '2-rev',
    appId: 'existing-app-id',
    accessToken: 'sync-access-token',
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

test('repinSavedRecord keeps already pinned requests on the happy path', async () => {
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

test('repinSavedRecord loads the saved png as a data url before handing it to the pin window', async () => {
  const fs = require('fs')
  const originalReadFile = fs.promises.readFile
  let receivedImageSrc = ''
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

  fs.promises.readFile = async (filePath) => {
    assert.equal(filePath, path.resolve('/tmp/save', 'translated.png'))
    return jpegBuffer
  }

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
        repinSavedRecordImage: async ({ imageSrc }) => {
          receivedImageSrc = imageSrc
          return { ok: true, code: 'already-pinned' }
        },
      },
    },
  )

  await services.repinSavedRecord('record-1')

  assert.equal(receivedImageSrc, `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`)

  cleanup()
  fs.promises.readFile = originalReadFile
})

test('runCaptureTranslationPin starts the workflow after the official screenCapture bridge returns an image', async () => {
  let screenCaptureCalls = 0
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
      screenCapture: (callback) => {
        screenCaptureCalls += 1
        callback('data:image/png;base64,abc123')
      },
      baiduPictureTranslateModule: {
        translateCapturedImage: async ({ captureResult, settings, credentials }) => {
          assert.equal(captureResult.image, 'data:image/png;base64,abc123')
          assert.equal(settings.translationMode, 'auto')
          assert.equal(credentials.appId, '')
          return {
            ok: true,
            translatedImageDataUrl: 'data:image/png;base64,translated',
          }
        },
        getLastTranslationDebug: () => null,
      },
      pinWindowManagerModule: {
        pinTranslatedImage: async () => ({
          ok: true,
          code: 'success',
          windowId: 99,
          bounds: { x: 100, y: 24, width: 240, height: 120 },
        }),
      },
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.equal(screenCaptureCalls, 1)
  assert.deepEqual(result, {
    ok: true,
    code: 'success',
  })

  cleanup()
})

test('runCaptureTranslationPin keeps capture-cancelled when the official screenCapture bridge is cancelled', async () => {
  let screenCaptureCalls = 0
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
      screenCapture: (callback) => {
        screenCaptureCalls += 1
        callback('')
      },
    },
  )

  const result = await services.runCaptureTranslationPin()

  assert.equal(screenCaptureCalls, 1)
  assert.deepEqual(result, {
    ok: false,
    code: 'capture-cancelled',
  })

  cleanup()
})
