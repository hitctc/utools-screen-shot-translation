import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  normalizeBookmarkCache,
  normalizeUiSettings,
  normalizePinnedBookmarkMap,
  normalizeRecentOpenedMap,
  togglePinnedBookmark,
  recordBookmarkOpen,
  sortBookmarksByPinnedAndOrder,
  sortBookmarksByRecentOpen,
} = require('../../public/preload/localState.cjs')

test('normalizeBookmarkCache keeps valid cache data and sanitizes bookmark items', () => {
  const result = normalizeBookmarkCache({
    filePath: '  /Users/test/Bookmarks  ',
    total: '999',
    cachedAt: '1710000000000',
    items: [
      {
        id: ' 1 ',
        url: ' https://example.com ',
        sourceRoot: ' bookmark_bar ',
        folderPath: ['  Root  ', '', null, ' Sub '],
        dateAdded: ' 1710000000001 ',
        title: ' Example ',
      },
      {
        id: '2',
        url: 'https://example.org',
        sourceRoot: 'other',
        folderPath: 'not-an-array',
        dateAdded: 123,
        title: 456,
      },
      {
        id: '',
        url: 'https://invalid.test',
        sourceRoot: 'synced',
      },
    ],
  })

  assert.deepEqual(result, {
    filePath: '/Users/test/Bookmarks',
    total: 2,
    cachedAt: 1710000000000,
    items: [
      {
        id: '1',
        url: 'https://example.com',
        sourceRoot: 'bookmark_bar',
        folderPath: ['Root', 'Sub'],
        dateAdded: '1710000000001',
        title: 'Example',
      },
      {
        id: '2',
        url: 'https://example.org',
        sourceRoot: 'other',
        folderPath: [],
        dateAdded: '',
        title: '',
      },
    ],
  })
})

test('normalizeBookmarkCache returns null for unusable cache payloads', () => {
  const missingFilePath = normalizeBookmarkCache({
    cachedAt: 1710000000000,
    items: [
      { id: '1', url: 'https://example.com', sourceRoot: 'bookmark_bar' },
    ],
  })
  const missingTimestamp = normalizeBookmarkCache({
    filePath: '/Users/test/Bookmarks',
    items: [
      { id: '1', url: 'https://example.com', sourceRoot: 'bookmark_bar' },
    ],
  })
  const missingItems = normalizeBookmarkCache({
    filePath: '/Users/test/Bookmarks',
    cachedAt: 1710000000000,
    items: [{ id: '', url: '', sourceRoot: '' }],
  })

  assert.equal(missingFilePath, null)
  assert.equal(missingTimestamp, null)
  assert.equal(missingItems, null)
})

test('normalizeUiSettings merges saved settings with defaults', () => {
  const result = normalizeUiSettings({ showRecentOpened: false })

  assert.deepEqual(result, {
    showRecentOpened: false,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
})

test('normalizeUiSettings keeps both recent-opened and open-count toggles', () => {
  const result = normalizeUiSettings({
    showRecentOpened: false,
    showOpenCount: false,
  })

  assert.deepEqual(result, {
    showRecentOpened: false,
    showOpenCount: false,
    themeMode: 'system',
    windowHeight: 640,
  })
})

test('normalizeUiSettings falls back to system theme mode for missing or invalid values', () => {
  const missingResult = normalizeUiSettings({})
  const invalidResult = normalizeUiSettings({ themeMode: 'neon' })

  assert.deepEqual(missingResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
  assert.deepEqual(invalidResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
})

test('normalizeUiSettings preserves dark and light theme modes', () => {
  const darkResult = normalizeUiSettings({ themeMode: 'dark' })
  const lightResult = normalizeUiSettings({ themeMode: 'light' })

  assert.deepEqual(darkResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'dark',
    windowHeight: 640,
  })
  assert.deepEqual(lightResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'light',
    windowHeight: 640,
  })
})

test('normalizeUiSettings preserves a valid window height', () => {
  const result = normalizeUiSettings({ windowHeight: 720 })

  assert.deepEqual(result, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 720,
  })
})

test('normalizeUiSettings falls back to default window height for invalid values', () => {
  const zeroResult = normalizeUiSettings({ windowHeight: 0 })
  const negativeResult = normalizeUiSettings({ windowHeight: -120 })
  const textResult = normalizeUiSettings({ windowHeight: 'bad' })

  assert.deepEqual(zeroResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
  assert.deepEqual(negativeResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
  assert.deepEqual(textResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 640,
  })
})

test('normalizeUiSettings clamps window height into the supported slider range', () => {
  const lowResult = normalizeUiSettings({ windowHeight: 240 })
  const highResult = normalizeUiSettings({ windowHeight: 1200 })

  assert.deepEqual(lowResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 480,
  })
  assert.deepEqual(highResult, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
    windowHeight: 960,
  })
})

test('normalizePinnedBookmarkMap drops invalid bookmark ids and timestamps', () => {
  const result = normalizePinnedBookmarkMap({
    a: 100,
    b: 'bad',
    '': 200,
  })

  assert.deepEqual(result, { a: 100 })
})

test('normalizeRecentOpenedMap drops invalid open records', () => {
  const result = normalizeRecentOpenedMap({
    a: { bookmarkId: 'a', openedAt: 100, openCount: 2 },
    b: { bookmarkId: 'b', openedAt: 0, openCount: 1 },
    c: { bookmarkId: 'c', openedAt: 200, openCount: 0 },
  })

  assert.deepEqual(result, {
    a: { bookmarkId: 'a', openedAt: 100, openCount: 2 },
  })
})

test('togglePinnedBookmark stores and removes bookmark ids in local map', () => {
  const pinnedAt = 1710000000000
  const first = togglePinnedBookmark({}, 'bookmark-1', pinnedAt)
  const second = togglePinnedBookmark(first, 'bookmark-1', pinnedAt + 1)

  assert.deepEqual(first, { 'bookmark-1': pinnedAt })
  assert.deepEqual(second, {})
})

test('recordBookmarkOpen increments open count and updates openedAt timestamp', () => {
  const first = recordBookmarkOpen({}, 'bookmark-1', 100)
  const second = recordBookmarkOpen(first, 'bookmark-1', 200)

  assert.deepEqual(second, {
    'bookmark-1': {
      bookmarkId: 'bookmark-1',
      openedAt: 200,
      openCount: 2,
    },
  })
})

test('sortBookmarksByPinnedAndOrder puts pinned items first but keeps original order inside groups', () => {
  const items = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]
  const result = sortBookmarksByPinnedAndOrder(items, { b: 10 })

  assert.deepEqual(result.map(item => item.id), ['b', 'a', 'c'])
})

test('sortBookmarksByRecentOpen sorts records by openedAt desc then openCount desc', () => {
  const items = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]
  const result = sortBookmarksByRecentOpen(items, {
    a: { bookmarkId: 'a', openedAt: 100, openCount: 1 },
    b: { bookmarkId: 'b', openedAt: 200, openCount: 1 },
    c: { bookmarkId: 'c', openedAt: 200, openCount: 3 },
  })

  assert.deepEqual(result.map(item => item.id), ['c', 'b', 'a'])
})
