import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const {
  translateCapturedImage,
} = require('../../public/preload/baiduPictureTranslate.cjs')

test('translateCapturedImage returns translation-config-invalid when credentials are missing', async () => {
  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'en-to-zh',
    },
    credentials: {
      appId: '',
      appKey: '',
    },
    requestImpl: async () => {
      throw new Error('request should not run without credentials')
    },
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-config-invalid',
  })
})

test('translateCapturedImage sends the expected direction and returns the pasted image payload', async () => {
  const requests = []

  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'en-to-zh',
    },
    credentials: {
      appId: 'test-app-id',
      appKey: 'test-app-key',
    },
    createSalt: () => 'salt-001',
    requestImpl: async (request) => {
      requests.push(request)

      return {
        error_code: '0',
        error_msg: 'success',
        data: {
          from: 'en',
          to: 'zh',
          sumSrc: 'Hello world',
          sumDst: '你好，世界',
          pasteImg: 'dHJhbnNsYXRlZA==',
          content: [],
        },
      }
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].from, 'en')
  assert.equal(requests[0].to, 'zh')
  assert.equal(requests[0].appId, 'test-app-id')
  assert.equal(requests[0].salt, 'salt-001')
  assert.equal(requests[0].imageMimeType, 'image/png')
  assert.equal(requests[0].imageBuffer.equals(Buffer.from('hello')), true)

  assert.deepEqual(result, {
    ok: true,
    provider: 'baidu-picture-translate',
    from: 'en',
    to: 'zh',
    sourceText: 'Hello world',
    translatedText: '你好，世界',
    translatedImageBase64: 'dHJhbnNsYXRlZA==',
    translatedImageDataUrl: 'data:image/png;base64,dHJhbnNsYXRlZA==',
    content: [],
  })
})

test('translateCapturedImage retries with the opposite direction when auto mode detects english source text', async () => {
  const requests = []

  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'auto',
    },
    credentials: {
      appId: 'test-app-id',
      appKey: 'test-app-key',
    },
    requestImpl: async (request) => {
      requests.push(`${request.from}->${request.to}`)

      if (request.from === 'zh') {
        return {
          error_code: '0',
          error_msg: 'success',
          data: {
            from: 'en',
            to: 'en',
            sumSrc: 'Hello world',
            sumDst: 'Hello world',
            pasteImg: 'Zmlyc3Q=',
            content: [],
          },
        }
      }

      return {
        error_code: '0',
        error_msg: 'success',
        data: {
          from: 'en',
          to: 'zh',
          sumSrc: 'Hello world',
          sumDst: '你好，世界',
          pasteImg: 'c2Vjb25k',
          content: [],
        },
      }
    },
  })

  assert.deepEqual(requests, ['zh->en', 'en->zh'])
  assert.equal(result.ok, true)
  assert.equal(result.to, 'zh')
  assert.equal(result.translatedText, '你好，世界')
  assert.equal(result.translatedImageBase64, 'c2Vjb25k')
})

test('translateCapturedImage still falls back to environment credentials for development runs', async () => {
  const requests = []

  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'zh-to-en',
    },
    credentials: {
      appId: '',
      appKey: '',
    },
    env: {
      BAIDU_FANYI_APP_ID: 'env-app-id',
      BAIDU_FANYI_APP_KEY: 'env-app-key',
    },
    requestImpl: async (request) => {
      requests.push(request)
      return {
        error_code: '0',
        error_msg: 'success',
        data: {
          from: 'zh',
          to: 'en',
          sumSrc: '你好',
          sumDst: 'Hello',
          pasteImg: 'ZW52LXBhc3Rl',
          content: [],
        },
      }
    },
  })

  assert.equal(requests[0].appId, 'env-app-id')
  assert.equal(result.ok, true)
  assert.equal(result.translatedText, 'Hello')
})
