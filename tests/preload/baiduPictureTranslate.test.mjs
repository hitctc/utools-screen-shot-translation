import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'

const require = createRequire(import.meta.url)

const {
  translateCapturedImage,
  getLastTranslationDebug,
} = require('../../public/preload/baiduPictureTranslate.cjs')

test('translateCapturedImage sends V2 credentials through Authorization Bearer header', async () => {
  const https = require('https')
  const originalRequest = https.request
  let observedUrl = ''
  let observedHeaders = null
  let observedBody = ''

  https.request = (url, options, callback) => {
    observedUrl = url
    observedHeaders = options?.headers ?? null

    const response = new EventEmitter()
    response.statusCode = 200

    const request = new EventEmitter()
    request.write = (chunk) => {
      observedBody += String(chunk)
    }
    request.end = () => {
      callback(response)
      response.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            from: 'zh',
            to: 'en',
            src: '你好',
            dst: 'Hello',
            paste_img: 'dGVzdC1wYXN0ZS1pbWFnZQ==',
            contents: [],
          }),
          'utf8',
        ),
      )
      response.emit('end')
    }
    request.on = (eventName, handler) => {
      EventEmitter.prototype.on.call(request, eventName, handler)
      return request
    }

    return request
  }

  try {
    const result = await translateCapturedImage({
      captureResult: {
        ok: true,
        image: 'data:image/png;base64,aGVsbG8=',
      },
      settings: {
        translationMode: 'zh-to-en',
      },
      credentials: {
        appId: 'test-app-id',
        accessToken: 'test-access-token',
      },
    })

    assert.equal(observedUrl, 'https://fanyi-api.baidu.com/ait/api/picture/translate')
    assert.equal(observedHeaders.Authorization, 'Bearer test-access-token')
    assert.match(observedBody, /"appid":"test-app-id"/)
    assert.equal(result.ok, true)
    assert.equal(result.version, 'v2')
  } finally {
    https.request = originalRequest
  }
})

test('translateCapturedImage returns translation-config-invalid when V2 credentials are unavailable', async () => {
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
      accessToken: '',
    },
    requestImplV2: async () => {
      throw new Error('V2 request should not run without credentials')
    },
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-config-invalid',
  })
})

test('translateCapturedImage prefers V2 when access token is available and returns the pasted image payload', async () => {
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
      accessToken: 'test-access-token',
    },
    requestImplV2: async (request) => {
      requests.push(request)

      return {
        from: 'en',
        to: 'zh',
        src: 'Hello world',
        dst: '你好，世界',
        paste_img: 'dHJhbnNsYXRlZA==',
        contents: [],
      }
    },
  })

  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0], {
    appId: 'test-app-id',
    accessToken: 'test-access-token',
    from: 'en',
    to: 'zh',
    imageBase64: 'aGVsbG8=',
    paste: 2,
  })

  assert.deepEqual(result, {
    ok: true,
    provider: 'baidu-picture-translate',
    version: 'v2',
    from: 'en',
    to: 'zh',
    sourceText: 'Hello world',
    translatedText: '你好，世界',
    translatedImageBase64: 'dHJhbnNsYXRlZA==',
    translatedImageDataUrl: 'data:image/png;base64,dHJhbnNsYXRlZA==',
    content: [],
  })
})

test('translateCapturedImage retries with the opposite direction when auto mode uses V2 and detects english source text', async () => {
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
      accessToken: 'test-access-token',
    },
    requestImplV2: async (request) => {
      requests.push(`${request.from}->${request.to}`)

      if (request.from === 'zh') {
        return {
          from: 'en',
          to: 'en',
          src: 'Hello world',
          dst: 'Hello world',
          paste_img: 'Zmlyc3Q=',
          contents: [],
        }
      }

      return {
        from: 'en',
        to: 'zh',
        src: 'Hello world',
        dst: '你好，世界',
        paste_img: 'c2Vjb25k',
        contents: [],
      }
    },
  })

  assert.deepEqual(requests, ['zh->en', 'en->zh'])
  assert.equal(result.ok, true)
  assert.equal(result.version, 'v2')
  assert.equal(result.to, 'zh')
  assert.equal(result.translatedText, '你好，世界')
  assert.equal(result.translatedImageBase64, 'c2Vjb25k')
})

test('translateCapturedImage falls back to environment V2 credentials for development runs', async () => {
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
      accessToken: '',
    },
    env: {
      BAIDU_FANYI_APP_ID: 'env-app-id',
      BAIDU_FANYI_ACCESS_TOKEN: 'env-access-token',
    },
    requestImplV2: async (request) => {
      requests.push(request)
      return {
        from: 'zh',
        to: 'en',
        src: '你好',
        dst: 'Hello',
        paste_img: 'ZW52LXBhc3Rl',
        contents: [],
      }
    },
  })

  assert.equal(requests[0].appId, 'env-app-id')
  assert.equal(requests[0].accessToken, 'env-access-token')
  assert.equal(result.ok, true)
  assert.equal(result.version, 'v2')
  assert.equal(result.translatedText, 'Hello')
})

test('translateCapturedImage requires access token and rejects incomplete V2 credentials', async () => {
  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'zh-to-en',
    },
    credentials: {
      appId: 'test-app-id',
      accessToken: '',
    },
    env: {
      BAIDU_FANYI_APP_ID: 'env-app-id',
    },
    requestImplV2: async () => {
      throw new Error('V2 request should not run without access token')
    },
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'translation-config-invalid',
  })
  assert.deepEqual(getLastTranslationDebug(), {
    attemptedVersion: '',
    usedVersion: '',
    translationMode: 'zh-to-en',
    credentialMode: '',
    responseHasTopLevelPasteImage: false,
    responseContentCount: 0,
    responseContentPasteImageCount: 0,
    composedImageStrategy: 'missing-credentials',
    composedImageSucceeded: false,
  })
})

test('translateCapturedImage keeps the translated image mime type when V2 returns jpeg bytes', async () => {
  const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64')

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
      accessToken: 'test-access-token',
    },
    requestImplV2: async () => ({
      from: 'en',
      to: 'zh',
      src: 'Hello world',
      dst: '你好，世界',
      paste_img: jpegBase64,
      contents: [],
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.version, 'v2')
  assert.equal(result.translatedImageBase64, jpegBase64)
  assert.equal(result.translatedImageDataUrl, `data:image/jpeg;base64,${jpegBase64}`)
})

test('translateCapturedImage composes a readable V2 block image when only contents[].paste_img is returned', async () => {
  const composeCalls = []

  const result = await translateCapturedImage({
    captureResult: {
      ok: true,
      image: 'data:image/png;base64,aGVsbG8=',
    },
    settings: {
      translationMode: 'zh-to-en',
    },
    credentials: {
      appId: 'test-app-id',
      accessToken: 'test-access-token',
    },
    requestImplV2: async () => ({
      from: 'zh',
      to: 'en',
      src: '硬按进同一投稿。',
      dst: 'Modify hard pressed into the same submission.',
      contents: [
        {
          src: '硬按进同一投稿。',
          dst: 'Modify hard pressed into the same submission.',
          rect: {
            left: 12,
            top: 8,
            width: 220,
            height: 42,
          },
          paste_img: 'YmxvY2stcGFzdGU=',
        },
      ],
    }),
    composeTranslatedBlocks: async (payload) => {
      composeCalls.push(payload)
      return {
        ok: true,
        translatedImageBase64: 'Y29tcG9zZWQtcG5n',
        translatedImageDataUrl: 'data:image/png;base64,Y29tcG9zZWQtcG5n',
      }
    },
  })

  assert.equal(composeCalls.length, 1)
  assert.equal(composeCalls[0].captureImage.imageMimeType, 'image/png')
  assert.equal(composeCalls[0].responseData.contents.length, 1)
  assert.deepEqual(result, {
    ok: true,
    provider: 'baidu-picture-translate',
    version: 'v2',
    from: 'zh',
    to: 'en',
    sourceText: '硬按进同一投稿。',
    translatedText: 'Modify hard pressed into the same submission.',
    translatedImageBase64: 'Y29tcG9zZWQtcG5n',
    translatedImageDataUrl: 'data:image/png;base64,Y29tcG9zZWQtcG5n',
    content: [
      {
        src: '硬按进同一投稿。',
        dst: 'Modify hard pressed into the same submission.',
        rect: {
          left: 12,
          top: 8,
          width: 220,
          height: 42,
        },
        paste_img: 'YmxvY2stcGFzdGU=',
      },
    ],
  })

  assert.deepEqual(getLastTranslationDebug(), {
    attemptedVersion: 'v2',
    usedVersion: 'v2',
    translationMode: 'zh-to-en',
    credentialMode: 'v2',
    responseHasTopLevelPasteImage: false,
    responseContentCount: 1,
    responseContentPasteImageCount: 1,
    composedImageStrategy: 'block-compose',
    composedImageSucceeded: true,
  })
})

test('translateCapturedImage prefers local text composition over top-level paste when V2 returns rect and dst blocks', async () => {
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
      accessToken: 'test-access-token',
    },
    requestImplV2: async () => ({
      from: 'en',
      to: 'zh',
      src: 'Hello world',
      dst: '你好，世界',
      paste_img: 'dG9wLWxldmVsLXBhc3Rl',
      contents: [
        {
          src: 'Hello world',
          dst: '你好，世界',
          rect: {
            left: 12,
            top: 8,
            width: 220,
            height: 42,
          },
        },
      ],
    }),
    composeTranslatedBlocks: async () => ({
      ok: true,
      translatedImageBase64: 'dG9wLWxldmVsLXNraXBwZWQ=',
      translatedImageDataUrl: 'data:image/png;base64,dG9wLWxldmVsLXNraXBwZWQ=',
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.translatedImageBase64, 'dG9wLWxldmVsLXNraXBwZWQ=')
  assert.deepEqual(getLastTranslationDebug(), {
    attemptedVersion: 'v2',
    usedVersion: 'v2',
    translationMode: 'en-to-zh',
    credentialMode: 'v2',
    responseHasTopLevelPasteImage: true,
    responseContentCount: 1,
    responseContentPasteImageCount: 0,
    composedImageStrategy: 'block-text-compose',
    composedImageSucceeded: true,
  })
})

test('translateCapturedImage retries with paste=1 when paste=2 returns no renderable image', async () => {
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
      appId: 'test-app-id',
      accessToken: 'test-access-token',
    },
    requestImplV2: async (request) => {
      requests.push(request)

      if (request.paste === 2) {
        return {
          from: 'zh',
          to: 'en',
          src: '你好',
          dst: 'Hello',
          paste_img: '',
          contents: [
            {
              src: '你好',
              dst: 'Hello',
              rect: '10,12,64,24',
              paste_img: '',
            },
          ],
        }
      }

      return {
        from: 'zh',
        to: 'en',
        src: '你好',
        dst: 'Hello',
        paste_img: 'ZmFsbGJhY2stcGFzdGU=',
        contents: [],
      }
    },
    composeTranslatedBlocks: async () => null,
  })

  assert.deepEqual(
    requests.map((request) => request.paste),
    [2, 1],
  )
  assert.equal(result.ok, true)
  assert.equal(result.translatedImageBase64, 'ZmFsbGJhY2stcGFzdGU=')
  assert.deepEqual(getLastTranslationDebug(), {
    attemptedVersion: 'v2',
    usedVersion: 'v2',
    translationMode: 'zh-to-en',
    credentialMode: 'v2',
    responseHasTopLevelPasteImage: true,
    responseContentCount: 0,
    responseContentPasteImageCount: 0,
    composedImageStrategy: 'paste-1-fallback',
    composedImageSucceeded: false,
    attemptedPasteMode: 2,
    fallbackPasteMode: 1,
    errorCode: '',
    errorMessage: '',
  })
})

test('translateCapturedImage keeps paste=2 as the final result when contents contain rect and dst but no paste_img', async () => {
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
      appId: 'test-app-id',
      accessToken: 'test-access-token',
    },
    requestImplV2: async (request) => {
      requests.push(request)

      return {
        from: 'zh',
        to: 'en',
        src: '开发和调试2',
        dst: 'Development and debugging 2',
        contents: [
          {
            rect: '0,0,240,48',
            dst: 'Development and debugging 2',
          },
        ],
      }
    },
    composeTranslatedBlocks: async () => ({
      ok: true,
      translatedImageBase64: 'dGV4dC1jb21wb3NlZA==',
      translatedImageDataUrl: 'data:image/png;base64,dGV4dC1jb21wb3NlZA==',
    }),
  })

  assert.deepEqual(
    requests.map((request) => request.paste),
    [2],
  )
  assert.equal(result.ok, true)
  assert.equal(result.translatedImageBase64, 'dGV4dC1jb21wb3NlZA==')
  assert.deepEqual(getLastTranslationDebug(), {
    attemptedVersion: 'v2',
    usedVersion: 'v2',
    translationMode: 'zh-to-en',
    credentialMode: 'v2',
    responseHasTopLevelPasteImage: false,
    responseContentCount: 1,
    responseContentPasteImageCount: 0,
    composedImageStrategy: 'block-text-compose',
    composedImageSucceeded: true,
  })
})
