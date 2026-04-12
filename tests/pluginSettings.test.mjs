import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getSaveDirectoryWarning,
  getTranslationCredentialWarning,
  normalizePluginSettings,
  normalizeTranslationCredentials,
} from '../src/screenTranslation/pluginSettings.js'

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

test('normalizeTranslationCredentials trims the synced baidu credentials', () => {
  assert.deepEqual(
    normalizeTranslationCredentials({
      appId: '  app-id  ',
      accessToken: '  access-token  ',
    }),
    {
      appId: 'app-id',
      accessToken: 'access-token',
    },
  )
})

test('getTranslationCredentialWarning surfaces the V2 half-filled credential state only when needed', () => {
  assert.equal(
    getTranslationCredentialWarning({
      appId: 'app-id',
      accessToken: '',
    }),
    '百度图片翻译 V2 凭证尚未填写完整，请同时提供 AppID 和 Access Token。',
  )

  assert.equal(
    getTranslationCredentialWarning({
      appId: 'app-id',
      accessToken: 'access-token',
    }),
    '',
  )
})

test('getTranslationCredentialWarning only recognizes V2 credentials', () => {
  assert.equal(
    getTranslationCredentialWarning({
      appId: '',
      accessToken: '',
    }),
    '',
  )

  assert.equal(
    getTranslationCredentialWarning({
      appId: '',
      accessToken: 'access-token',
    }),
    '百度图片翻译 V2 凭证尚未填写完整，请同时提供 AppID 和 Access Token。',
  )

  assert.equal(
    getTranslationCredentialWarning({
      appId: 'app-id',
      accessToken: '',
    }),
    '百度图片翻译 V2 凭证尚未填写完整，请同时提供 AppID 和 Access Token。',
  )
})
