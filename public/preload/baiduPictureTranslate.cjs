const https = require('https')
const { buildImageDataUrlFromBase64 } = require('./imageMime.cjs')
const { composeTranslatedBlocksToPng } = require('./baiduPictureCompose.cjs')

const BAIDU_PICTURE_TRANSLATE_V2_URL = 'https://fanyi-api.baidu.com/ait/api/picture/translate'
const BAIDU_ENV_KEYS = {
  appId: 'BAIDU_FANYI_APP_ID',
  accessToken: 'BAIDU_FANYI_ACCESS_TOKEN',
}
let lastTranslationDebug = null

function setLastTranslationDebug(payload) {
  lastTranslationDebug = payload && typeof payload === 'object' ? { ...payload } : null
}

function getLastTranslationDebug() {
  return lastTranslationDebug ? { ...lastTranslationDebug } : null
}

function normalizeBaiduErrorCode(value) {
  const normalizedValue = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  return normalizedValue && normalizedValue !== '0' ? normalizedValue : ''
}

function normalizeBaiduErrorMessage(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// V2 当前是唯一保留的图片翻译接入方式，这里只保留 AppID 和 Access Token。
// 统一 trim 是为了避免同步文档或环境变量里的脏空格干扰实际鉴权。
function normalizeCredentials(raw) {
  const candidate = raw && typeof raw === 'object' ? raw : {}

  return {
    appId: typeof candidate.appId === 'string' ? candidate.appId.trim() : '',
    accessToken: typeof candidate.accessToken === 'string' ? candidate.accessToken.trim() : '',
  }
}

// 图片翻译桥接只接受当前产品定义的三种模式，其他值统一回退成自动。
function normalizeTranslationMode(value) {
  if (value === 'en-to-zh' || value === 'zh-to-en') {
    return value
  }

  return 'auto'
}

// 百度接口都要求基于原始图片字节或 base64 发送，这里统一把截图结果解成 Buffer 与纯 base64。
function decodeCapturedImage(image) {
  if (typeof image !== 'string' || !image.trim()) {
    return null
  }

  const trimmed = image.trim()
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    const [, mimeType, base64Payload] = dataUrlMatch

    return {
      imageBuffer: Buffer.from(base64Payload, 'base64'),
      imageBase64: base64Payload,
      imageMimeType: mimeType || 'image/png',
      imageDataUrl: trimmed,
    }
  }

  return {
    imageBuffer: Buffer.from(trimmed, 'base64'),
    imageBase64: trimmed,
    imageMimeType: 'image/png',
    imageDataUrl: `data:image/png;base64,${trimmed}`,
  }
}

// 成功响应里优先取汇总字段，没有时再拼分段内容，保证自动模式能做语言判断。
function getAggregateText(value, fieldNames) {
  for (const fieldName of fieldNames) {
    if (typeof value?.[fieldName] === 'string' && value[fieldName].trim()) {
      return value[fieldName].trim()
    }
  }

  const contentList = Array.isArray(value?.content)
    ? value.content
    : Array.isArray(value?.contents)
      ? value.contents
      : []
  if (!contentList.length) {
    return ''
  }

  return contentList
    .map((item) => {
      for (const fieldName of fieldNames) {
        if (typeof item?.[fieldName] === 'string') {
          return item[fieldName]
        }
      }

      return ''
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

// 自动模式只关心中英两类字符占比，不做更重的语言识别。
function detectSourceLanguageFromText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return ''
  }

  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishCount = (text.match(/[A-Za-z]/g) || []).length

  if (chineseCount > englishCount && chineseCount > 0) {
    return 'zh'
  }

  if (englishCount > chineseCount && englishCount > 0) {
    return 'en'
  }

  return ''
}

// 百度返回的 from 可能已经是实际识别语种，这里只保留当前产品支持的 zh / en。
function normalizeBaiduLanguage(value) {
  if (value === 'zh' || value === 'en') {
    return value
  }

  return ''
}

function mapCommonTranslationResult({
  responseData,
  translatedImageBase64,
  provider,
  version,
}) {
  const normalizedImageBase64 =
    typeof translatedImageBase64 === 'string' ? translatedImageBase64.trim() : ''
  if (!normalizedImageBase64) {
    return null
  }

  const contentList = Array.isArray(responseData?.content)
    ? responseData.content
    : Array.isArray(responseData?.contents)
      ? responseData.contents
      : []

  return {
    ok: true,
    provider,
    version,
    from: typeof responseData?.from === 'string' ? responseData.from : '',
    to: typeof responseData?.to === 'string' ? responseData.to : '',
    sourceText: getAggregateText(responseData, ['sumSrc', 'src']),
    translatedText: getAggregateText(responseData, ['sumDst', 'dst']),
    translatedImageBase64: normalizedImageBase64,
    translatedImageDataUrl: buildImageDataUrlFromBase64(normalizedImageBase64),
    content: contentList,
  }
}

// V2 的返回字段改成 snake_case，这里统一映射成现有主流程可消费的契约。
function mapSuccessfulTranslationResultV2(responseData, translatedImageBase64) {
  return mapCommonTranslationResult({
    responseData,
    translatedImageBase64,
    provider: 'baidu-picture-translate',
    version: 'v2',
  })
}

// V2 优先走块级回填拼图；如果块数据不可用，再退回官方整图 paste_img。
async function resolveTranslatedImageBase64V2({
  responseData,
  captureImage,
  composeTranslatedBlocks,
  electron,
}) {
  const contentList = Array.isArray(responseData?.contents) ? responseData.contents : []
  const hasBlockPasteImages = contentList.some(
    (item) => typeof item?.paste_img === 'string' && item.paste_img.trim(),
  )
  const hasRenderableBlockText = contentList.some(
    (item) =>
      (typeof item?.dst === 'string' && item.dst.trim()) &&
      (typeof item?.rect === 'string' || (item?.rect && typeof item.rect === 'object') || (item && typeof item === 'object')),
  )
  const responseHasTopLevelPasteImage = typeof responseData?.paste_img === 'string' && responseData.paste_img.trim() !== ''
  const debug = {
    responseHasTopLevelPasteImage,
    responseContentCount: contentList.length,
    responseContentPasteImageCount: contentList.filter(
      (item) => typeof item?.paste_img === 'string' && item.paste_img.trim(),
    ).length,
    composedImageStrategy: 'missing-image',
    composedImageSucceeded: false,
  }

  if ((hasBlockPasteImages || hasRenderableBlockText) && typeof composeTranslatedBlocks === 'function') {
    const composedImage = await composeTranslatedBlocks({
      captureImage,
      responseData,
      electron,
    })

    if (composedImage?.ok && typeof composedImage.translatedImageBase64 === 'string') {
      return {
        translatedImageBase64: composedImage.translatedImageBase64.trim(),
        debug: {
          ...debug,
          composedImageStrategy: hasBlockPasteImages ? 'block-compose' : 'block-text-compose',
          composedImageSucceeded: true,
        },
      }
    }

    debug.composedImageStrategy = hasBlockPasteImages ? 'block-compose' : 'block-text-compose'
  }

  if (responseHasTopLevelPasteImage) {
    return {
      translatedImageBase64: responseData.paste_img.trim(),
      debug: {
        ...debug,
        composedImageStrategy: 'top-level-paste',
      },
    }
  }

  return {
    translatedImageBase64: '',
    debug,
  }
}

// 自动模式会优先看 OCR 出来的原文语言，不清楚时再退回文本是否真的发生变化。
function chooseAutoTranslationResult(primaryResult, secondaryResult) {
  const detectedLanguage =
    detectSourceLanguageFromText(primaryResult?.sourceText) ||
    detectSourceLanguageFromText(secondaryResult?.sourceText) ||
    normalizeBaiduLanguage(primaryResult?.from) ||
    normalizeBaiduLanguage(secondaryResult?.from)

  if (detectedLanguage === 'zh') {
    return primaryResult
  }

  if (detectedLanguage === 'en') {
    return secondaryResult
  }

  const primaryLooksTranslated =
    typeof primaryResult?.sourceText === 'string' &&
    typeof primaryResult?.translatedText === 'string' &&
    primaryResult.sourceText.trim() !== '' &&
    primaryResult.sourceText.trim() !== primaryResult.translatedText.trim()
  const secondaryLooksTranslated =
    typeof secondaryResult?.sourceText === 'string' &&
    typeof secondaryResult?.translatedText === 'string' &&
    secondaryResult.sourceText.trim() !== '' &&
    secondaryResult.sourceText.trim() !== secondaryResult.translatedText.trim()

  if (secondaryLooksTranslated && !primaryLooksTranslated) {
    return secondaryResult
  }

  return primaryResult
}

// V2 根据官方文档改成 JSON 请求，并固定开启高精擦除模式以争取更好的版式还原。
// 运行时探测已确认接口实际识别的是 Authorization Bearer 头，而不是 query/body 里的 access_token。
function requestBaiduPictureTranslateV2({
  appId,
  accessToken,
  from,
  to,
  imageBase64,
  paste = 2,
}) {
  const payload = JSON.stringify({
    from,
    to,
    appid: appId,
    content: imageBase64,
    paste,
    need_intervene: 0,
    view_type: 1,
    model_type: 'nmt',
  })

  return new Promise((resolve, reject) => {
    const request = https.request(
      BAIDU_PICTURE_TRANSLATE_V2_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (error) {
            reject(error)
          }
        })
      },
    )

    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

function shouldTreatV2ResponseAsFailure(response) {
  const errorCode = normalizeBaiduErrorCode(response?.error_code)
  if (errorCode) {
    return true
  }

  const errorMessage = normalizeBaiduErrorMessage(response?.error_msg)
  if (!errorMessage) {
    return false
  }

  const hasTranslatedText =
    typeof response?.src === 'string' ||
    typeof response?.dst === 'string' ||
    Array.isArray(response?.contents)

  return !hasTranslatedText
}

async function translateWithDirectionV2({
  direction,
  credentials,
  captureImage,
  requestImpl,
  composeTranslatedBlocks,
  electron,
  translationMode,
}) {
  try {
    const primaryResponse = await requestImpl({
      appId: credentials.appId,
      accessToken: credentials.accessToken,
      from: direction.from,
      to: direction.to,
      imageBase64: captureImage.imageBase64,
      paste: 2,
    })

    const primaryErrorCode = normalizeBaiduErrorCode(primaryResponse?.error_code)
    const primaryErrorMessage = normalizeBaiduErrorMessage(primaryResponse?.error_msg)
    const canRetryWithPaste1 = primaryErrorCode === '55004'

    if (shouldTreatV2ResponseAsFailure(primaryResponse) && !canRetryWithPaste1) {
      setLastTranslationDebug({
        attemptedVersion: 'v2',
        usedVersion: '',
        translationMode,
        credentialMode: 'v2',
        responseHasTopLevelPasteImage: false,
        responseContentCount: 0,
        responseContentPasteImageCount: 0,
        composedImageStrategy: 'request-failed',
        composedImageSucceeded: false,
        errorCode: primaryErrorCode,
        errorMessage: primaryErrorMessage,
        attemptedPasteMode: 2,
      })
      return {
        ok: false,
        code: 'translation-failed',
      }
    }

    const resolvedImage = await resolveTranslatedImageBase64V2({
      responseData: primaryResponse,
      captureImage,
      composeTranslatedBlocks,
      electron,
    })

    const primaryMappedResult = mapSuccessfulTranslationResultV2(
      primaryResponse,
      resolvedImage.translatedImageBase64,
    )

    if (primaryMappedResult) {
      setLastTranslationDebug({
        attemptedVersion: 'v2',
        usedVersion: 'v2',
        translationMode,
        credentialMode: 'v2',
        ...resolvedImage.debug,
      })
      return primaryMappedResult
    }

    const fallbackResponse = await requestImpl({
      appId: credentials.appId,
      accessToken: credentials.accessToken,
      from: direction.from,
      to: direction.to,
      imageBase64: captureImage.imageBase64,
      paste: 1,
    })
    const fallbackErrorCode = normalizeBaiduErrorCode(fallbackResponse?.error_code)
    const fallbackErrorMessage = normalizeBaiduErrorMessage(fallbackResponse?.error_msg)

    if (shouldTreatV2ResponseAsFailure(fallbackResponse)) {
      setLastTranslationDebug({
        attemptedVersion: 'v2',
        usedVersion: '',
        translationMode,
        credentialMode: 'v2',
        ...resolvedImage.debug,
        fallbackPasteMode: 1,
        fallbackErrorCode,
        fallbackErrorMessage,
        attemptedPasteMode: 2,
      })
      return {
        ok: false,
        code: 'translation-failed',
      }
    }

    const fallbackMappedResult = mapSuccessfulTranslationResultV2(
      fallbackResponse,
      fallbackResponse?.paste_img,
    )

    setLastTranslationDebug({
      attemptedVersion: 'v2',
      usedVersion: fallbackMappedResult ? 'v2' : '',
      translationMode,
      credentialMode: 'v2',
      responseHasTopLevelPasteImage: typeof fallbackResponse?.paste_img === 'string' && fallbackResponse.paste_img.trim() !== '',
      responseContentCount: Array.isArray(fallbackResponse?.contents) ? fallbackResponse.contents.length : 0,
      responseContentPasteImageCount: 0,
      composedImageStrategy: fallbackMappedResult ? 'paste-1-fallback' : 'missing-image',
      composedImageSucceeded: false,
      attemptedPasteMode: 2,
      fallbackPasteMode: 1,
      errorCode: primaryErrorCode,
      errorMessage: primaryErrorMessage,
    })

    return fallbackMappedResult ?? { ok: false, code: 'translation-failed' }
  } catch (error) {
    setLastTranslationDebug({
      attemptedVersion: 'v2',
      usedVersion: '',
      translationMode,
      credentialMode: 'v2',
      responseHasTopLevelPasteImage: false,
      responseContentCount: 0,
      responseContentPasteImageCount: 0,
      composedImageStrategy: 'request-failed',
      composedImageSucceeded: false,
      errorCode: '',
      errorMessage: error instanceof Error ? error.message : '',
    })
    return {
      ok: false,
      code: 'translation-failed',
    }
  }
}

async function translateAutoModeV2({
  credentials,
  captureImage,
  requestImpl,
  composeTranslatedBlocks,
  electron,
  translationMode,
}) {
  const zhToEnResult = await translateWithDirectionV2({
    direction: { from: 'zh', to: 'en' },
    credentials,
    captureImage,
    requestImpl,
    composeTranslatedBlocks,
    electron,
    translationMode,
  })

  if (!zhToEnResult.ok) {
    return zhToEnResult
  }

  const primarySourceLanguage =
    detectSourceLanguageFromText(zhToEnResult.sourceText) || normalizeBaiduLanguage(zhToEnResult.from)
  if (primarySourceLanguage === 'zh') {
    return zhToEnResult
  }

  const enToZhResult = await translateWithDirectionV2({
    direction: { from: 'en', to: 'zh' },
    credentials,
    captureImage,
    requestImpl,
    composeTranslatedBlocks,
    electron,
    translationMode,
  })

  if (!enToZhResult.ok) {
    return primarySourceLanguage === 'en' ? enToZhResult : zhToEnResult
  }

  return chooseAutoTranslationResult(zhToEnResult, enToZhResult)
}

function resolveCredentialSet({ credentials, env }) {
  const syncedCredentials = normalizeCredentials(credentials)
  const envCredentials = normalizeCredentials({
    appId: env?.[BAIDU_ENV_KEYS.appId],
    accessToken: env?.[BAIDU_ENV_KEYS.accessToken],
  })

  return (
    syncedCredentials.appId && syncedCredentials.accessToken
      ? { appId: syncedCredentials.appId, accessToken: syncedCredentials.accessToken }
      : envCredentials.appId && envCredentials.accessToken
        ? { appId: envCredentials.appId, accessToken: envCredentials.accessToken }
        : null
  )
}

// 翻译桥接当前只保留 V2，避免设置模型、失败文案和实际调用再出现双轨语义。
async function translateCapturedImage({
  captureResult,
  settings,
  credentials,
  env = process.env,
  requestImplV2 = requestBaiduPictureTranslateV2,
  composeTranslatedBlocks = composeTranslatedBlocksToPng,
  electron,
} = {}) {
  const resolvedV2Credentials = resolveCredentialSet({ credentials, env })
  const translationMode = normalizeTranslationMode(settings?.translationMode)

  if (!resolvedV2Credentials) {
    setLastTranslationDebug({
      attemptedVersion: '',
      usedVersion: '',
      translationMode,
      credentialMode: '',
      responseHasTopLevelPasteImage: false,
      responseContentCount: 0,
      responseContentPasteImageCount: 0,
      composedImageStrategy: 'missing-credentials',
      composedImageSucceeded: false,
    })
    return {
      ok: false,
      code: 'translation-config-invalid',
    }
  }

  const captureImage = decodeCapturedImage(captureResult?.image)
  if (!captureImage || captureImage.imageBuffer.length === 0) {
    setLastTranslationDebug({
      attemptedVersion: resolvedV2Credentials ? 'v2' : '',
      usedVersion: '',
      translationMode,
      credentialMode: resolvedV2Credentials ? 'v2' : '',
      responseHasTopLevelPasteImage: false,
      responseContentCount: 0,
      responseContentPasteImageCount: 0,
      composedImageStrategy: 'invalid-capture',
      composedImageSucceeded: false,
    })
    return {
      ok: false,
      code: 'translation-failed',
    }
  }

  const useV2 = !!resolvedV2Credentials

  if (useV2) {
    if (translationMode === 'en-to-zh') {
      return translateWithDirectionV2({
        direction: { from: 'en', to: 'zh' },
        credentials: resolvedV2Credentials,
        captureImage,
        requestImpl: requestImplV2,
        composeTranslatedBlocks,
        electron,
        translationMode,
      })
    }

    if (translationMode === 'zh-to-en') {
      return translateWithDirectionV2({
        direction: { from: 'zh', to: 'en' },
        credentials: resolvedV2Credentials,
        captureImage,
        requestImpl: requestImplV2,
        composeTranslatedBlocks,
        electron,
        translationMode,
      })
    }

    return translateAutoModeV2({
      credentials: resolvedV2Credentials,
      captureImage,
      requestImpl: requestImplV2,
      composeTranslatedBlocks,
      electron,
      translationMode,
    })
  }
}

module.exports = {
  BAIDU_ENV_KEYS,
  getLastTranslationDebug,
  translateCapturedImage,
}
