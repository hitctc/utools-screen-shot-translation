const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

function hasSignature(buffer, signature) {
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length) {
    return false
  }

  return signature.every((value, index) => buffer[index] === value)
}

// 百度返回图和保存目录里的旧记录扩展名并不可靠，这里只认真实字节头。
function detectImageMimeTypeFromBuffer(buffer) {
  if (hasSignature(buffer, JPEG_SIGNATURE)) {
    return 'image/jpeg'
  }

  if (hasSignature(buffer, PNG_SIGNATURE)) {
    return 'image/png'
  }

  return 'image/png'
}

// data url 会继续喂给 peg window 的 canvas，这里必须带上和真实字节一致的 mime。
function buildImageDataUrlFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return ''
  }

  return `data:${detectImageMimeTypeFromBuffer(buffer)};base64,${buffer.toString('base64')}`
}

// 百度接口给的是 base64 字符串，这里统一转成 buffer 再判断 mime。
function buildImageDataUrlFromBase64(base64) {
  if (typeof base64 !== 'string' || !base64.trim()) {
    return ''
  }

  const buffer = Buffer.from(base64.trim(), 'base64')
  return buildImageDataUrlFromBuffer(buffer)
}

module.exports = {
  detectImageMimeTypeFromBuffer,
  buildImageDataUrlFromBuffer,
  buildImageDataUrlFromBase64,
}
