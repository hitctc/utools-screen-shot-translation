import test from 'node:test'
import assert from 'node:assert/strict'

import { dismissBootShell } from '../../src/bootShell.js'

test('dismissBootShell removes the static boot shell and marks app ready', () => {
  let removed = false
  const rootAttributes = {}
  const bootShell = {
    parentNode: {
      removeChild(node) {
        removed = node === bootShell
      },
    },
  }

  const documentStub = {
    documentElement: {
      setAttribute(name, value) {
        rootAttributes[name] = value
      },
    },
    getElementById(id) {
      return id === 'app-boot-shell' ? bootShell : null
    },
  }

  dismissBootShell(documentStub)

  assert.equal(rootAttributes['data-app-ready'], 'true')
  assert.equal(removed, true)
})
