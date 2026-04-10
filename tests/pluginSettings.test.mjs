import test from 'node:test'
import assert from 'node:assert/strict'

import { getSaveDirectoryWarning, normalizePluginSettings } from '../src/screenTranslation/pluginSettings.js'

test('normalizePluginSettings ignores old plugin setting fields and keeps the new contract', () => {
  assert.deepEqual(
    normalizePluginSettings({
      sourceLanguage: 'en',
      targetLanguage: 'zh-CN',
      pinPreviewMode: 'overlay',
      translationMode: 'zh-to-en',
      saveTranslatedImage: true,
      saveDirectory: ' /tmp/translated ',
      confirmBeforeDelete: false,
    }),
    {
      translationMode: 'zh-to-en',
      saveTranslatedImage: true,
      saveDirectory: '/tmp/translated',
      confirmBeforeDelete: false,
    },
  )
})

test('getSaveDirectoryWarning surfaces the missing directory state only when needed', () => {
  assert.equal(
    getSaveDirectoryWarning({
      translationMode: 'auto',
      saveTranslatedImage: true,
      saveDirectory: '',
      confirmBeforeDelete: true,
    }),
    '已开启保存结果图片，但保存目录为空，请先填写保存目录。',
  )

  assert.equal(
    getSaveDirectoryWarning({
      translationMode: 'auto',
      saveTranslatedImage: false,
      saveDirectory: '',
      confirmBeforeDelete: true,
    }),
    '',
  )
})
