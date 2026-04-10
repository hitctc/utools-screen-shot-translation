import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const {
  TRANSLATION_CREDENTIALS_DOC_ID,
  normalizeTranslationCredentials,
  getTranslationCredentials,
  saveTranslationCredentials,
} = require('../../public/preload/translationCredentialStore.cjs')

test('normalizeTranslationCredentials trims app id and app key', () => {
  assert.deepEqual(
    normalizeTranslationCredentials({
      appId: '  test-app-id  ',
      appKey: '  test-app-key  ',
    }),
    {
      appId: 'test-app-id',
      appKey: 'test-app-key',
    },
  )
})

test('getTranslationCredentials returns empty credentials when the sync document is missing', () => {
  const result = getTranslationCredentials({
    get() {
      return null
    },
  })

  assert.deepEqual(result, {
    appId: '',
    appKey: '',
  })
})

test('saveTranslationCredentials creates the sync document and merges partial updates', () => {
  let storedDoc = null
  const db = {
    get(id) {
      assert.equal(id, TRANSLATION_CREDENTIALS_DOC_ID)
      return storedDoc
    },
    put(doc) {
      storedDoc = {
        ...doc,
        _rev: '2-rev',
      }

      return {
        ok: true,
        id: doc._id,
        rev: '2-rev',
      }
    },
  }

  const first = saveTranslationCredentials(db, {
    appId: ' sync-app-id ',
  })
  const second = saveTranslationCredentials(db, {
    appKey: ' sync-app-key ',
  })

  assert.deepEqual(first, {
    appId: 'sync-app-id',
    appKey: '',
  })
  assert.deepEqual(second, {
    appId: 'sync-app-id',
    appKey: 'sync-app-key',
  })
  assert.deepEqual(storedDoc, {
    _id: TRANSLATION_CREDENTIALS_DOC_ID,
    _rev: '2-rev',
    appId: 'sync-app-id',
    appKey: 'sync-app-key',
    updatedAt: storedDoc.updatedAt,
  })
})
