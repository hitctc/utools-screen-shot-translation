import test from 'node:test'
import assert from 'node:assert/strict'
import { sortItemsPinnedFirst } from '../../src/bookmarks/itemOrder.js'

test('sortItemsPinnedFirst puts pinned search results first and keeps original order inside groups', () => {
  const items = [
    { id: 'alpha', title: 'Alpha' },
    { id: 'beta', title: 'Beta' },
    { id: 'gamma', title: 'Gamma' },
    { id: 'delta', title: 'Delta' },
  ]

  const result = sortItemsPinnedFirst(items, {
    delta: 20,
    beta: 10,
  })

  assert.deepEqual(result.map(item => item.id), ['beta', 'delta', 'alpha', 'gamma'])
})
