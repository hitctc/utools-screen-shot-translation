const { buildImageDataUrlFromBase64, buildImageDataUrlFromBuffer } = require('./imageMime.cjs')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SOI = 0xffd8
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
])

function loadElectronModule(explicitElectron) {
  if (explicitElectron && typeof explicitElectron === 'object') {
    return explicitElectron
  }

  try {
    return require('electron')
  } catch {
    return null
  }
}

// 组合块级译图时必须知道原图尺寸，这里只支持当前链路会出现的 PNG / JPEG。
function getImageSizeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return null
  }

  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }

  if (buffer.readUInt16BE(0) !== JPEG_SOI) {
    return null
  }

  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const segmentLength = buffer.readUInt16BE(offset + 2)

    if (JPEG_SOF_MARKERS.has(marker) && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    if (segmentLength < 2) {
      break
    }

    offset += 2 + segmentLength
  }

  return null
}

function normalizeRect(rect) {
  if (typeof rect === 'string' && rect.trim()) {
    const numericValues = rect
      .split(',')
      .map((value) => Math.round(Number(value.trim())))

    if (numericValues.length >= 4) {
      const [left, top, width, height] = numericValues

      if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
        return { left, top, width, height }
      }
    }
  }

  if (Array.isArray(rect) && rect.length >= 4) {
    const [left, top, width, height] = rect.map((value) => Math.round(Number(value)))
    if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
      return { left, top, width, height }
    }
  }

  const candidate = rect && typeof rect === 'object' ? rect : {}
  const left = Math.round(Number(candidate.left ?? candidate.x))
  const top = Math.round(Number(candidate.top ?? candidate.y))
  const width = Math.round(Number(candidate.width))
  const height = Math.round(Number(candidate.height))

  if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    return { left, top, width, height }
  }

  const points = Array.isArray(candidate.points) ? candidate.points : []
  if (points.length >= 2) {
    const normalizedPoints = points
      .map((point) => ({
        x: Math.round(Number(point?.x)),
        y: Math.round(Number(point?.y)),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))

    if (normalizedPoints.length >= 2) {
      const xValues = normalizedPoints.map((point) => point.x)
      const yValues = normalizedPoints.map((point) => point.y)
      const minX = Math.min(...xValues)
      const maxX = Math.max(...xValues)
      const minY = Math.min(...yValues)
      const maxY = Math.max(...yValues)

      if (maxX > minX && maxY > minY) {
        return {
          left: minX,
          top: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      }
    }
  }

  return null
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeTextContent(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function estimateCharacterUnits(character) {
  if (/\s/.test(character)) {
    return 0.34
  }

  if (/[\u4e00-\u9fff]/.test(character)) {
    return 1
  }

  if (/[A-Z0-9]/.test(character)) {
    return 0.66
  }

  if (/[a-z]/.test(character)) {
    return 0.56
  }

  if (/[.,:;'"!?()[\]{}\-_/\\|]/.test(character)) {
    return 0.34
  }

  return 0.72
}

function measureTextUnits(text) {
  return Array.from(String(text || '')).reduce(
    (total, character) => total + estimateCharacterUnits(character),
    0,
  )
}

function tokenizeForWrap(text) {
  const normalizedText = typeof text === 'string' ? text.replace(/\r/g, '').trim() : ''
  if (!normalizedText) {
    return []
  }

  if (/\s/.test(normalizedText)) {
    return normalizedText.match(/\S+\s*/g) || []
  }

  return Array.from(normalizedText)
}

function wrapTextTokens(tokens, maxUnitsPerLine) {
  const lines = []
  let currentLine = ''
  let currentUnits = 0

  for (const token of tokens) {
    const normalizedToken = token.replace(/\s+$/g, '')
    if (!normalizedToken) {
      continue
    }

    const tokenUnits = measureTextUnits(normalizedToken)
    if (!currentLine) {
      currentLine = normalizedToken
      currentUnits = tokenUnits
      continue
    }

    if (currentUnits + tokenUnits <= maxUnitsPerLine) {
      currentLine += normalizedToken
      currentUnits += tokenUnits
      continue
    }

    lines.push(currentLine)
    currentLine = normalizedToken
    currentUnits = tokenUnits
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function createTextOverlayLayout(rect, text) {
  const normalizedText = typeof text === 'string' ? text.trim() : ''
  if (!rect || !normalizedText) {
    return null
  }

  const inset = Math.max(4, Math.round(Math.min(rect.width, rect.height) * 0.12))
  const innerWidth = Math.max(16, rect.width - inset * 2)
  const innerHeight = Math.max(16, rect.height - inset * 2)
  const tokens = tokenizeForWrap(normalizedText)

  if (!tokens.length) {
    return null
  }

  const maxFontSize = Math.max(12, Math.min(Math.floor(innerHeight * 0.88), Math.floor(innerWidth * 0.42)))
  const minFontSize = 10

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const maxUnitsPerLine = innerWidth / fontSize
    const lines = wrapTextTokens(tokens, maxUnitsPerLine)
    const lineHeight = Math.max(fontSize * 1.18, fontSize + 2)
    const totalHeight = lines.length * lineHeight

    if (lines.length > 0 && totalHeight <= innerHeight) {
      const longestLineUnits = lines.reduce(
        (maxUnits, line) => Math.max(maxUnits, measureTextUnits(line)),
        0,
      )
      const contentWidth = Math.min(innerWidth, Math.max(fontSize, Math.ceil(longestLineUnits * fontSize)))
      const contentHeight = Math.min(innerHeight, Math.ceil(totalHeight))
      const paddingX = Math.max(6, Math.round(fontSize * 0.42))
      const paddingY = Math.max(4, Math.round(fontSize * 0.28))
      const boxWidth = Math.min(rect.width, contentWidth + paddingX * 2)
      const boxHeight = Math.min(rect.height, contentHeight + paddingY * 2)
      const boxLeft = rect.left + Math.min(inset, Math.max(0, rect.width - boxWidth))
      const boxTop = rect.top + Math.min(inset, Math.max(0, rect.height - boxHeight))

      return {
        lines,
        fontSize,
        lineHeight,
        inset,
        boxLeft,
        boxTop,
        boxWidth,
        boxHeight,
        textLeft: boxLeft + paddingX,
        textStartY: boxTop + paddingY + fontSize,
      }
    }
  }

  const fallbackFontSize = minFontSize
  const fallbackLines = wrapTextTokens(tokens, Math.max(1, innerWidth / fallbackFontSize))
  const fallbackLineHeight = Math.max(fallbackFontSize * 1.18, fallbackFontSize + 2)
  const fallbackLongestLineUnits = fallbackLines.reduce(
    (maxUnits, line) => Math.max(maxUnits, measureTextUnits(line)),
    0,
  )
  const fallbackContentWidth = Math.min(innerWidth, Math.max(fallbackFontSize, Math.ceil(fallbackLongestLineUnits * fallbackFontSize)))
  const fallbackContentHeight = Math.min(innerHeight, Math.ceil(fallbackLines.length * fallbackLineHeight))
  const fallbackPaddingX = Math.max(6, Math.round(fallbackFontSize * 0.42))
  const fallbackPaddingY = Math.max(4, Math.round(fallbackFontSize * 0.28))
  const fallbackBoxWidth = Math.min(rect.width, fallbackContentWidth + fallbackPaddingX * 2)
  const fallbackBoxHeight = Math.min(rect.height, fallbackContentHeight + fallbackPaddingY * 2)
  const fallbackBoxLeft = rect.left + Math.min(inset, Math.max(0, rect.width - fallbackBoxWidth))
  const fallbackBoxTop = rect.top + Math.min(inset, Math.max(0, rect.height - fallbackBoxHeight))

  return {
    lines: fallbackLines,
    fontSize: fallbackFontSize,
    lineHeight: fallbackLineHeight,
    inset,
    boxLeft: fallbackBoxLeft,
    boxTop: fallbackBoxTop,
    boxWidth: fallbackBoxWidth,
    boxHeight: fallbackBoxHeight,
    textLeft: fallbackBoxLeft + fallbackPaddingX,
    textStartY: fallbackBoxTop + fallbackPaddingY + fallbackFontSize,
  }
}

// 只保留百度 V2 返回里真正可用于回填的块，避免脏块把整张图拼坏。
function normalizeTranslatedBlocks(contents) {
  return (Array.isArray(contents) ? contents : [])
    .map((item) => {
      const rect = normalizeRect(item?.rect || item)
      const pasteImageDataUrl = buildImageDataUrlFromBase64(item?.paste_img)
      const translatedText = typeof item?.dst === 'string' ? item.dst.trim() : ''

      if (!rect || (!pasteImageDataUrl && !translatedText)) {
        return null
      }

      return {
        rect,
        pasteImageDataUrl,
        translatedText,
      }
    })
    .filter(Boolean)
}

function buildCompositeSvgDataUrl({ backgroundImageDataUrl, imageSize, blocks, includeBackgroundImage = false }) {
  const width = Math.max(1, Math.round(Number(imageSize?.width)))
  const height = Math.max(1, Math.round(Number(imageSize?.height)))

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return ''
  }

  const blockMarkup = blocks
    .map((block) => {
      if (block.pasteImageDataUrl) {
        return `<image href="${escapeAttribute(block.pasteImageDataUrl)}" x="${block.rect.left}" y="${block.rect.top}" width="${block.rect.width}" height="${block.rect.height}" preserveAspectRatio="none" />`
      }

      const textLayout = createTextOverlayLayout(block.rect, block.translatedText)
      if (!textLayout) {
        return ''
      }

      const overlayRadius = Math.max(6, Math.round(Math.min(textLayout.boxWidth, textLayout.boxHeight) * 0.18))
      const textMarkup = textLayout.lines
        .map(
          (line, index) =>
            `<tspan x="${textLayout.textLeft}" y="${textLayout.textStartY + index * textLayout.lineHeight}">${escapeTextContent(line)}</tspan>`,
        )
        .join('')

      return `<rect x="${textLayout.boxLeft}" y="${textLayout.boxTop}" width="${textLayout.boxWidth}" height="${textLayout.boxHeight}" rx="${overlayRadius}" ry="${overlayRadius}" fill="rgba(15,15,15,0.74)" /><text fill="#f5f5f5" font-family="Space Grotesk,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${textLayout.fontSize}" font-weight="600">${textMarkup}</text>`
    })
    .join('')
  const backgroundMarkup =
    includeBackgroundImage && backgroundImageDataUrl
      ? `<image href="${escapeAttribute(backgroundImageDataUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />`
      : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${backgroundMarkup}${blockMarkup}</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 默认用 Electron nativeImage 把 SVG 数据转成 PNG 字节，保证后续钉图和保存链路都继续吃位图。
function rasterizeSvgToPngBase64({ svgDataUrl, electron }) {
  const nativeImage = loadElectronModule(electron)?.nativeImage
  if (!nativeImage || typeof nativeImage.createFromDataURL !== 'function') {
    return ''
  }

  const image = nativeImage.createFromDataURL(svgDataUrl)
  const size = typeof image?.getSize === 'function' ? image.getSize() : null

  if (!size?.width || !size?.height || typeof image?.toPNG !== 'function') {
    return ''
  }

  const pngBuffer = image.toPNG()
  return Buffer.isBuffer(pngBuffer) && pngBuffer.length > 0 ? pngBuffer.toString('base64') : ''
}

// V2 的块级回填优先保留原截图背景，只把百度已经排好的译文块重新贴回去。
async function composeTranslatedBlocksToPng({
  captureImage,
  responseData,
  electron,
  rasterizeSvgImpl = rasterizeSvgToPngBase64,
} = {}) {
  const backgroundImageDataUrl =
    typeof captureImage?.imageDataUrl === 'string' && captureImage.imageDataUrl.trim()
      ? captureImage.imageDataUrl.trim()
      : buildImageDataUrlFromBuffer(captureImage?.imageBuffer)
  const imageSize = getImageSizeFromBuffer(captureImage?.imageBuffer)
  const blocks = normalizeTranslatedBlocks(responseData?.contents)

  if (!imageSize || !blocks.length) {
    return null
  }

  const svgDataUrl = buildCompositeSvgDataUrl({
    backgroundImageDataUrl,
    imageSize,
    blocks,
    // 钉图层本来就叠在原屏幕上，继续把整张截图背景带进去只会形成大面积遮挡。
    includeBackgroundImage: false,
  })
  if (!svgDataUrl) {
    return null
  }

  const translatedImageBase64 = await rasterizeSvgImpl({
    svgDataUrl,
    electron,
    imageSize,
    blocks,
  })

  if (typeof translatedImageBase64 !== 'string' || !translatedImageBase64.trim()) {
    return null
  }

  const normalizedBase64 = translatedImageBase64.trim()
  return {
    ok: true,
    translatedImageBase64: normalizedBase64,
    translatedImageDataUrl: buildImageDataUrlFromBase64(normalizedBase64),
  }
}

module.exports = {
  composeTranslatedBlocksToPng,
}
