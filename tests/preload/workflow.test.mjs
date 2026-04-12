import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const { runMainWorkflow } = require('../../public/preload/workflow.cjs')

function createWorkflowDeps(overrides = {}) {
  return {
    settings: {
      translationMode: 'auto',
      saveTranslatedImage: false,
      saveDirectory: '',
      confirmBeforeDelete: true,
    },
    captureImage: async () => ({ ok: true, image: 'data:image/png;base64,captured' }),
    translateImage: async () => ({ ok: true, text: 'translated text' }),
    pinImage: async () => ({ ok: true, bounds: { left: 10, top: 20, right: 30, bottom: 40 } }),
    saveImage: async () => ({ ok: true, recordId: 'record-1' }),
    ...overrides,
  }
}

test('runMainWorkflow returns save-config-invalid when saving is enabled without a directory', async () => {
  let captureCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      settings: {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: '',
        confirmBeforeDelete: true,
      },
      captureImage: async () => {
        captureCalls += 1
        return { ok: true }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'save-config-invalid',
  })
  assert.equal(captureCalls, 0)
})

test('runMainWorkflow returns capture-cancelled when capture is cancelled', async () => {
  let translateCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      captureImage: async () => ({ ok: false, code: 'capture-cancelled' }),
      translateImage: async () => {
        translateCalls += 1
        return { ok: true }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'capture-cancelled',
  })
  assert.equal(translateCalls, 0)
})

test('runMainWorkflow returns translation-failed when translation fails', async () => {
  let pinCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      translateImage: async () => ({ ok: false, code: 'translation-failed' }),
      pinImage: async () => {
        pinCalls += 1
        return { ok: true }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-failed',
  })
  assert.equal(pinCalls, 0)
})

test('runMainWorkflow keeps explicit translation failure codes from the translate step', async () => {
  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      translateImage: async () => ({ ok: false, code: 'translation-config-invalid' }),
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-config-invalid',
  })
})

test('runMainWorkflow returns translation-failed when translation throws', async () => {
  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      translateImage: async () => {
        throw new Error('translator crashed')
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-failed',
  })
})

test('runMainWorkflow returns pin-failed when pinning fails', async () => {
  let saveCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      pinImage: async () => ({ ok: false, code: 'pin-failed' }),
      saveImage: async () => {
        saveCalls += 1
        return { ok: true }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'pin-failed',
  })
  assert.equal(saveCalls, 0)
})

test('runMainWorkflow returns pin-failed when pinning throws', async () => {
  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      pinImage: async () => {
        throw new Error('pin window creation failed')
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'pin-failed',
  })
})

test('runMainWorkflow returns save-failed when saving fails', async () => {
  let saveCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      settings: {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: '/tmp/translated',
        confirmBeforeDelete: true,
      },
      saveImage: async (_translationResult, _bounds) => {
        saveCalls += 1
        return { ok: false, code: 'save-failed' }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'save-failed',
  })
  assert.equal(saveCalls, 1)
})

test('runMainWorkflow returns save-failed when saving throws', async () => {
  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      settings: {
        translationMode: 'auto',
        saveTranslatedImage: true,
        saveDirectory: '/tmp/translated',
        confirmBeforeDelete: true,
      },
      saveImage: async () => {
        throw new Error('disk unavailable')
      },
    }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'save-failed',
  })
})

test('runMainWorkflow skips saveImage when saving is disabled', async () => {
  let saveCalls = 0

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      saveImage: async () => {
        saveCalls += 1
        return { ok: true }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: true,
    code: 'success',
  })
  assert.equal(saveCalls, 0)
})

test('runMainWorkflow returns success when capture only carries an image and downstream steps preserve it', async () => {
  const calls = []

  const result = await runMainWorkflow({
    ...createWorkflowDeps({
      settings: {
        translationMode: 'zh-to-en',
        saveTranslatedImage: true,
        saveDirectory: '/tmp/translated',
        confirmBeforeDelete: true,
      },
      captureImage: async () => ({
        ok: true,
        image: 'data:image/png;base64,captured',
      }),
      translateImage: async () => ({ ok: true, text: 'translated text', provider: 'stub' }),
      pinImage: async (translationResult, captureResult) => {
        calls.push({ step: 'pin', translationResult, captureResult })
        return {
          ok: true,
          bounds: { left: 100, top: 24, right: 340, bottom: 144 },
          windowId: 'pin-1',
        }
      },
      saveImage: async (translationResult, pinResult) => {
        calls.push({ step: 'save', translationResult, pinResult })
        return {
          ok: true,
          recordId: 'record-1',
        }
      },
    }),
  })

  assert.deepEqual(result, {
    ok: true,
    code: 'success',
  })
  assert.deepEqual(calls, [
    {
      step: 'pin',
      translationResult: { ok: true, text: 'translated text', provider: 'stub' },
      captureResult: { ok: true, image: 'data:image/png;base64,captured' },
    },
    {
      step: 'save',
      translationResult: { ok: true, text: 'translated text', provider: 'stub' },
      pinResult: {
        ok: true,
        bounds: { left: 100, top: 24, right: 340, bottom: 144 },
        windowId: 'pin-1',
      },
    },
  ])
})
