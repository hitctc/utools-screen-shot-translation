const crypto = require('crypto')
const https = require('https')

const BAIDU_PICTURE_TRANSLATE_URL = 'https://fanyi-api.baidu.com/api/trans/sdk/picture'
const BAIDU_CUID = 'APICUID'
const BAIDU_MAC = 'mac'
const BAIDU_VERSION = '3'
const BAIDU_PASTE = '1'
const BAIDU_ENV_KEYS = {
  appId: 'BAIDU_FANYI_APP_ID',
  appKey: 'BAIDU_FANYI_APP_KEY',
}

// 图片翻译桥接只接受当前产品定义的三种模式，其他值统一回退成自动。
function normalizeTranslationMode(value) {
  if (value === 'en-to-zh' || value === 'zh-to-en') {
    return value
  }

  return 'auto'
}

// 百度要求签名直接基于原始图片字节，因此这里统一把截图结果解成 Buffer。
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
      imageMimeType: mimeType || 'image/png',
    }
  }

  return {
    imageBuffer: Buffer.from(trimmed, 'base64'),
    imageMimeType: 'image/png',
  }
}

// 成功响应里优先取 sumSrc / sumDst，没有时再拼分段内容，保证自动模式能做语言判断。
function getAggregateText(value, fieldName) {
  if (typeof value?.[fieldName] === 'string' && value[fieldName].trim()) {
    return value[fieldName].trim()
  }

  if (!Array.isArray(value?.content)) {
    return ''
  }

  return value.content
    .map((item) => (typeof item?.[fieldName === 'sumSrc' ? 'src' : 'dst'] === 'string' ? item[fieldName === 'sumSrc' ? 'src' : 'dst'] : ''))
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

// 结果页和后续钉住 / 保存链路只吃统一字段，不直接暴露百度原始响应。
function mapSuccessfulTranslationResult(responseData) {
  const translatedImageBase64 = typeof responseData?.pasteImg === 'string' ? responseData.pasteImg.trim() : ''
  if (!translatedImageBase64) {
    return null
  }

  return {
    ok: true,
    provider: 'baidu-picture-translate',
    from: typeof responseData?.from === 'string' ? responseData.from : '',
    to: typeof responseData?.to === 'string' ? responseData.to : '',
    sourceText: getAggregateText(responseData, 'sumSrc'),
    translatedText: getAggregateText(responseData, 'sumDst'),
    translatedImageBase64,
    translatedImageDataUrl: `data:image/png;base64,${translatedImageBase64}`,
    content: Array.isArray(responseData?.content) ? responseData.content : [],
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

// 百度接口需要 multipart/form-data，这里保持纯 Node 实现，避免依赖运行时的 fetch/FormData。
function buildMultipartBody({ fields, imageBuffer, imageMimeType, boundary }) {
  const chunks = []

  Object.entries(fields).forEach(([name, value]) => {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`))
    chunks.push(Buffer.from(String(value)))
    chunks.push(Buffer.from('\r\n'))
  })

  const extension = imageMimeType === 'image/jpeg' || imageMimeType === 'image/jpg' ? 'jpg' : 'png'
  chunks.push(Buffer.from(`--${boundary}\r\n`))
  chunks.push(Buffer.from(`Content-Disposition: form-data; name="image"; filename="capture.${extension}"\r\n`))
  chunks.push(Buffer.from(`Content-Type: ${imageMimeType}\r\n\r\n`))
  chunks.push(imageBuffer)
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`))

  return Buffer.concat(chunks)
}

// 请求层只负责把百度接口的 JSON 响应拿回来，调用方再决定如何解释错误。
function requestBaiduPictureTranslate({
  appId,
  appKey,
  from,
  to,
  imageBuffer,
  imageMimeType,
  salt,
}) {
  const sign = crypto
    .createHash('md5')
    .update(
      `${appId}${crypto.createHash('md5').update(imageBuffer).digest('hex')}${salt}${BAIDU_CUID}${BAIDU_MAC}${appKey}`,
    )
    .digest('hex')
  const boundary = `----utools-screen-shot-translation-${salt}`
  const body = buildMultipartBody({
    fields: {
      from,
      to,
      appid: appId,
      salt,
      cuid: BAIDU_CUID,
      mac: BAIDU_MAC,
      version: BAIDU_VERSION,
      paste: BAIDU_PASTE,
      sign,
    },
    imageBuffer,
    imageMimeType,
    boundary,
  })

  return new Promise((resolve, reject) => {
    const request = https.request(
      BAIDU_PICTURE_TRANSLATE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          try {
            const payload = Buffer.concat(chunks).toString('utf8')
            resolve(JSON.parse(payload))
          } catch (error) {
            reject(error)
          }
        })
      },
    )

    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

// 单方向翻译结果统一在这里映射，调用方只关心成功态和稳定失败码。
async function translateWithDirection({
  direction,
  credentials,
  captureImage,
  requestImpl,
  createSalt,
}) {
  try {
    const response = await requestImpl({
      appId: credentials.appId,
      appKey: credentials.appKey,
      from: direction.from,
      to: direction.to,
      imageBuffer: captureImage.imageBuffer,
      imageMimeType: captureImage.imageMimeType,
      salt: createSalt(),
    })

    if (String(response?.error_code) !== '0') {
      return {
        ok: false,
        code: 'translation-failed',
      }
    }

    const mappedResult = mapSuccessfulTranslationResult(response.data)
    return mappedResult ?? { ok: false, code: 'translation-failed' }
  } catch {
    return {
      ok: false,
      code: 'translation-failed',
    }
  }
}

// 自动模式默认先尝试中文 -> 英文，确认源文是英文后再补第二次英文 -> 中文请求。
async function translateAutoMode({
  credentials,
  captureImage,
  requestImpl,
  createSalt,
}) {
  const zhToEnResult = await translateWithDirection({
    direction: { from: 'zh', to: 'en' },
    credentials,
    captureImage,
    requestImpl,
    createSalt,
  })

  if (!zhToEnResult.ok) {
    return zhToEnResult
  }

  const primarySourceLanguage =
    detectSourceLanguageFromText(zhToEnResult.sourceText) || normalizeBaiduLanguage(zhToEnResult.from)
  if (primarySourceLanguage === 'zh') {
    return zhToEnResult
  }

  const enToZhResult = await translateWithDirection({
    direction: { from: 'en', to: 'zh' },
    credentials,
    captureImage,
    requestImpl,
    createSalt,
  })

  if (!enToZhResult.ok) {
    return primarySourceLanguage === 'en' ? enToZhResult : zhToEnResult
  }

  return chooseAutoTranslationResult(zhToEnResult, enToZhResult)
}

// 翻译桥接对外只暴露一个入口，内部把环境变量、截图格式和百度请求细节全部收口。
async function translateCapturedImage({
  captureResult,
  settings,
  env = process.env,
  requestImpl = requestBaiduPictureTranslate,
  createSalt = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
} = {}) {
  const appId = typeof env?.[BAIDU_ENV_KEYS.appId] === 'string' ? env[BAIDU_ENV_KEYS.appId].trim() : ''
  const appKey = typeof env?.[BAIDU_ENV_KEYS.appKey] === 'string' ? env[BAIDU_ENV_KEYS.appKey].trim() : ''
  if (!appId || !appKey) {
    return {
      ok: false,
      code: 'translation-config-invalid',
    }
  }

  const captureImage = decodeCapturedImage(captureResult?.image)
  if (!captureImage || captureImage.imageBuffer.length === 0) {
    return {
      ok: false,
      code: 'translation-failed',
    }
  }

  const credentials = { appId, appKey }
  const translationMode = normalizeTranslationMode(settings?.translationMode)

  if (translationMode === 'en-to-zh') {
    return translateWithDirection({
      direction: { from: 'en', to: 'zh' },
      credentials,
      captureImage,
      requestImpl,
      createSalt,
    })
  }

  if (translationMode === 'zh-to-en') {
    return translateWithDirection({
      direction: { from: 'zh', to: 'en' },
      credentials,
      captureImage,
      requestImpl,
      createSalt,
    })
  }

  return translateAutoMode({
    credentials,
    captureImage,
    requestImpl,
    createSalt,
  })
}

module.exports = {
  BAIDU_ENV_KEYS,
  translateCapturedImage,
}
