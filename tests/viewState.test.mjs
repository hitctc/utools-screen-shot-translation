import test from 'node:test'
import assert from 'node:assert/strict'

import { mapSavedRecordToViewRecord, mapWorkflowFailureToResult } from '../src/screenTranslation/viewState.js'

test('mapWorkflowFailureToResult falls back to a safe retryable result for unknown codes', () => {
  assert.deepEqual(mapWorkflowFailureToResult('unexpected-code'), {
    title: '这次没有完成钉住',
    message: '流程执行失败，请重试。',
    showRetry: true,
    showOpenSettings: false,
    showClose: true,
  })
})

test('mapSavedRecordToViewRecord turns absolute local file paths into file urls', () => {
  const result = mapSavedRecordToViewRecord(
    {
      id: 'record-1',
      imageFilename: '/Users/demo/Pictures/translated image.png',
      createdAt: '2026-04-10T12:00:00.000Z',
    },
    0,
    '/Users/demo/Pictures',
  )

  assert.deepEqual(result, {
    id: 'record-1',
    imagePath: 'file:///Users/demo/Pictures/translated%20image.png',
    createdAtLabel: result.createdAtLabel,
    orderLabel: '#01',
  })
})

test('mapSavedRecordToViewRecord tolerates malformed createdAt values', () => {
  const result = mapSavedRecordToViewRecord(
    {
      id: 'record-2',
      imageFilename: 'translated.png',
      createdAt: 'not-a-date',
    },
    1,
    '/tmp/translated',
  )

  assert.deepEqual(result, {
    id: 'record-2',
    imagePath: 'file:///tmp/translated/translated.png',
    createdAtLabel: '时间未知',
    orderLabel: '#02',
  })
})
