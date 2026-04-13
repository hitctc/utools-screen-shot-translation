import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

function loadPanelState() {
  const source = fs.readFileSync(path.resolve('public/panel-state.js'), 'utf8')
  const context = {
    Intl,
    Date,
    encodeURI,
    window: {},
    globalThis: {},
  }

  vm.runInNewContext(source, context, {
    filename: 'public/panel-state.js',
  })

  return context.window.ScreenTranslationPanelState || context.globalThis.ScreenTranslationPanelState
}

test('panel state helpers format theme status and normalize records columns like the Vue shell', () => {
  const panelState = loadPanelState()

  assert.equal(panelState.formatThemeStatus('system', true), '跟随系统 / 深色')
  assert.equal(panelState.formatThemeStatus('light', false), '浅色')
  assert.equal(panelState.normalizeUiSettings({}).recordsColumnCount, 4)
  assert.equal(panelState.normalizeUiSettings({ recordsColumnCount: 9 }).recordsColumnCount, 4)
})

test('panel state helpers map saved records and split them into visual columns', () => {
  const panelState = loadPanelState()
  const records = [
    panelState.mapSavedRecordToViewRecord(
      { id: 'r1', imageFilename: 'one.png', createdAt: '2026-04-11T03:59:00.000Z' },
      0,
      '/tmp/output',
    ),
    panelState.mapSavedRecordToViewRecord(
      { id: 'r2', imageFilename: 'two.png', createdAt: '2026-04-11T03:58:00.000Z' },
      1,
      '/tmp/output',
    ),
    panelState.mapSavedRecordToViewRecord(
      { id: 'r3', imageFilename: 'three.png', createdAt: '2026-04-11T03:57:00.000Z' },
      2,
      '/tmp/output',
    ),
  ]
  const columns = panelState.splitRecordsIntoVisualColumns(records, 2)

  assert.equal(records[0].orderLabel, '#01')
  assert.equal(records[0].imagePath, 'file:///tmp/output/one.png')
  assert.deepEqual(
    JSON.parse(JSON.stringify(columns.map((column) => column.map((record) => record.id)))),
    [
      ['r1', 'r3'],
      ['r2'],
    ],
  )
})

test('panel state helpers keep the existing warning semantics for save directory and v2 credentials', () => {
  const panelState = loadPanelState()

  assert.equal(
    panelState.getSaveDirectoryWarning({
      saveTranslatedImage: true,
      saveDirectory: '',
    }),
    '已开启保存结果图片，但保存目录为空，请先填写保存目录。',
  )

  assert.equal(
    panelState.getTranslationCredentialWarning({
      appId: 'abc',
      accessToken: '',
    }),
    '百度图片翻译 V2 凭证尚未填写完整，请同时提供 AppID 和 Access Token。',
  )
})
