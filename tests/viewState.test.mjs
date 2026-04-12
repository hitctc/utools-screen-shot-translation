import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mapSavedRecordToViewRecord,
  mapWorkflowFailureToResult,
  splitRecordsIntoVisualColumns,
} from '../src/screenTranslation/viewState.js'

test('mapWorkflowFailureToResult explains missing translation credentials explicitly', () => {
  assert.deepEqual(mapWorkflowFailureToResult('translation-config-invalid'), {
    title: '翻译配置不完整',
    message: '当前还没有在设置页填写完整的百度图片翻译 V2 凭证，请同时补全 AppID 和 Access Token。',
    showRetry: true,
    showOpenSettings: true,
    showClose: true,
  })
})

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

test('splitRecordsIntoVisualColumns keeps waterfall numbering increasing from left to right', () => {
  const records = Array.from({ length: 8 }, (_, index) => ({
    id: `record-${index + 1}`,
    imagePath: `file:///tmp/${index + 1}.png`,
    createdAtLabel: `time-${index + 1}`,
    orderLabel: `#${String(index + 1).padStart(2, '0')}`,
  }))

  assert.deepEqual(splitRecordsIntoVisualColumns(records, 4), [
    [records[0], records[4]],
    [records[1], records[5]],
    [records[2], records[6]],
    [records[3], records[7]],
  ])
})

test('splitRecordsIntoVisualColumns falls back to a single column for invalid counts', () => {
  const records = [
    {
      id: 'record-1',
      imagePath: 'file:///tmp/1.png',
      createdAtLabel: 'time-1',
      orderLabel: '#01',
    },
    {
      id: 'record-2',
      imagePath: 'file:///tmp/2.png',
      createdAtLabel: 'time-2',
      orderLabel: '#02',
    },
  ]

  assert.deepEqual(splitRecordsIntoVisualColumns(records, 0), [records])
})
