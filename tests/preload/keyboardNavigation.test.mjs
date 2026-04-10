import test from 'node:test'
import assert from 'node:assert/strict'

import { getKeyboardNavigationResult } from '../../src/bookmarks/keyboardNavigation.js'

test('ArrowDown moves the highlight and preserves sub input focus', () => {
  const result = getKeyboardNavigationResult({
    key: 'ArrowDown',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 1,
    entryCount: 5,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  })

  assert.deepEqual(result, {
    action: 'move',
    nextIndex: 2,
    preventDefault: true,
    subInputBehavior: 'preserve',
  })
})

test('ArrowUp stops at the first item and preserves sub input focus', () => {
  const result = getKeyboardNavigationResult({
    key: 'ArrowUp',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 0,
    entryCount: 5,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  })

  assert.deepEqual(result, {
    action: 'move',
    nextIndex: 0,
    preventDefault: true,
    subInputBehavior: 'preserve',
  })
})

test('Escape asks the app to focus the sub input again', () => {
  const result = getKeyboardNavigationResult({
    key: 'Escape',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 2,
    entryCount: 5,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  })

  assert.deepEqual(result, {
    action: 'focus-search',
    nextIndex: 2,
    preventDefault: false,
    subInputBehavior: 'focus',
  })
})
