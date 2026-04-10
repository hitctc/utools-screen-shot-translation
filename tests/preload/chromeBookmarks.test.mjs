import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  getReadableStoredChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('../../public/preload/chromeBookmarks.cjs')

test('getDefaultChromeBookmarksPath returns macOS Chrome default bookmark path', () => {
  const result = getDefaultChromeBookmarksPath('/Users/demo')

  assert.equal(
    result,
    '/Users/demo/Library/Application Support/Google/Chrome/Default/Bookmarks',
  )
})

test('getEffectiveChromeBookmarksPath prefers saved path when non-empty', () => {
  const result = getEffectiveChromeBookmarksPath('/Users/demo', '  /tmp/custom-bookmarks  ')

  assert.equal(result, '/tmp/custom-bookmarks')
})

test('getEffectiveChromeBookmarksPath falls back to default path when saved path is empty', () => {
  const result = getEffectiveChromeBookmarksPath('/Users/demo', '   ')

  assert.equal(
    result,
    '/Users/demo/Library/Application Support/Google/Chrome/Default/Bookmarks',
  )
})

test('getReadableStoredChromeBookmarksPath keeps a synced path when it is readable on current device', () => {
  const result = getReadableStoredChromeBookmarksPath(
    '/Users/demo',
    '  /tmp/custom-bookmarks  ',
    filePath => filePath === '/tmp/custom-bookmarks',
  )

  assert.equal(result, '/tmp/custom-bookmarks')
})

test('getReadableStoredChromeBookmarksPath falls back to default when synced path is not readable on current device', () => {
  const result = getReadableStoredChromeBookmarksPath(
    '/Users/demo',
    '/Volumes/Other-Mac/Chrome/Bookmarks',
    () => false,
  )

  assert.equal(
    result,
    '/Users/demo/Library/Application Support/Google/Chrome/Default/Bookmarks',
  )
})

test('parseChromeBookmarksText flattens bookmark_bar, other and synced url nodes', () => {
  const sample = JSON.stringify({
    roots: {
      bookmark_bar: {
        children: [
          {
            type: 'folder',
            name: 'Work',
            children: [
              {
                id: '11',
                type: 'url',
                name: 'OpenAI',
                url: 'https://openai.com',
                date_added: '1',
              },
            ],
          },
        ],
      },
      other: {
        children: [
          {
            id: '12',
            type: 'url',
            name: 'GitHub',
            url: 'https://github.com',
            date_added: '2',
          },
        ],
      },
      synced: {
        children: [
          {
            id: '13',
            type: 'url',
            name: '',
            url: 'https://example.com',
            date_added: '3',
          },
        ],
      },
    },
  })

  const result = parseChromeBookmarksText(sample)

  assert.equal(result.total, 3)
  assert.deepEqual(
    result.items.map(item => ({
      id: item.id,
      title: item.title,
      folderPath: item.folderPath,
      sourceRoot: item.sourceRoot,
    })),
    [
      { id: '11', title: 'OpenAI', folderPath: ['Work'], sourceRoot: 'bookmark_bar' },
      { id: '12', title: 'GitHub', folderPath: [], sourceRoot: 'other' },
      { id: '13', title: '', folderPath: [], sourceRoot: 'synced' },
    ],
  )
})
