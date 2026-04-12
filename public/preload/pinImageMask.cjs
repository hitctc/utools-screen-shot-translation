const EDGE_WHITE_THRESHOLD = 234
const EDGE_ALPHA_THRESHOLD = 180
const EDGE_WHITE_CHROMA_THRESHOLD = 12
const CONTENT_ALPHA_THRESHOLD = 24
const CONTENT_BOUNDS_PADDING = 1

function isNearWhitePixel(data, pixelIndex) {
  const red = Number(data[pixelIndex])
  const green = Number(data[pixelIndex + 1])
  const blue = Number(data[pixelIndex + 2])
  const alpha = Number(data[pixelIndex + 3])
  const brightness = (red + green + blue) / 3
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue)

  return (
    alpha >= EDGE_ALPHA_THRESHOLD &&
    brightness >= EDGE_WHITE_THRESHOLD &&
    chroma <= EDGE_WHITE_CHROMA_THRESHOLD
  )
}

function getPixelIndex(x, y, width) {
  return (y * width + x) * 4
}

// 这里只清理从外边缘连通进来的中性浅底，目的是把翻译结果图里那层灰白底抠掉。
// 阈值故意放在“偏灰白”而不是“纯白”，这样百度返回的暖白背景也能被透明化。
function removeEdgeNearWhitePixels({ data, width, height }) {
  if (!data || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return data
  }

  const nextData = Uint8ClampedArray.from(data)
  const visited = new Uint8Array(width * height)
  const queue = []

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return
    }

    const flatIndex = y * width + x
    if (visited[flatIndex]) {
      return
    }

    const pixelIndex = getPixelIndex(x, y, width)
    if (!isNearWhitePixel(nextData, pixelIndex)) {
      return
    }

    visited[flatIndex] = 1
    queue.push([x, y])
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift()
    const pixelIndex = getPixelIndex(x, y, width)

    nextData[pixelIndex + 3] = 0

    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x, y - 1)
    enqueue(x, y + 1)
  }

  return nextData
}

function isVisibleContentPixel(data, pixelIndex) {
  return Number(data[pixelIndex + 3]) >= CONTENT_ALPHA_THRESHOLD
}

function clampBoundsWithPadding(bounds, width, height) {
  return {
    x: Math.max(0, bounds.x - CONTENT_BOUNDS_PADDING),
    y: Math.max(0, bounds.y - CONTENT_BOUNDS_PADDING),
    width: Math.min(width - 1, bounds.x + bounds.width - 1 + CONTENT_BOUNDS_PADDING) - Math.max(0, bounds.x - CONTENT_BOUNDS_PADDING) + 1,
    height: Math.min(height - 1, bounds.y + bounds.height - 1 + CONTENT_BOUNDS_PADDING) - Math.max(0, bounds.y - CONTENT_BOUNDS_PADDING) + 1,
  }
}

// 翻译图抠掉边缘浅底后，真正可见的内容会留下非透明像素。
// 这里直接按可见像素求最小包围盒，比按整行/整列均值判断更紧，能减少钉住后的无效留白。
function findVisibleContentBounds({ data, width, height }) {
  if (!data || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = getPixelIndex(x, y, width)
      if (!isVisibleContentPixel(data, pixelIndex)) {
        continue
      }

      if (x < minX) {
        minX = x
      }
      if (x > maxX) {
        maxX = x
      }
      if (y < minY) {
        minY = y
      }
      if (y > maxY) {
        maxY = y
      }
    }
  }

  if (minX < 0 || minY < 0 || maxX < minX || maxY < minY) {
    return null
  }

  return clampBoundsWithPadding({
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }, width, height)
}

// 图片像素级 bbox 需要先映射到当前实际显示内容区，才能拿来改 pin window 几何。
function scaleContentBoundsToTarget({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  bounds,
}) {
  const normalizedBounds = bounds && typeof bounds === 'object' ? {
    x: Math.round(Number(bounds.x)),
    y: Math.round(Number(bounds.y)),
    width: Math.round(Number(bounds.width)),
    height: Math.round(Number(bounds.height)),
  } : null

  if (
    !normalizedBounds ||
    ![sourceWidth, sourceHeight, targetWidth, targetHeight].every(Number.isFinite) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0 ||
    normalizedBounds.width <= 0 ||
    normalizedBounds.height <= 0
  ) {
    return null
  }

  return {
    x: Math.round((normalizedBounds.x * targetWidth) / sourceWidth),
    y: Math.round((normalizedBounds.y * targetHeight) / sourceHeight),
    width: Math.max(1, Math.round((normalizedBounds.width * targetWidth) / sourceWidth)),
    height: Math.max(1, Math.round((normalizedBounds.height * targetHeight) / sourceHeight)),
  }
}

module.exports = {
  findVisibleContentBounds,
  removeEdgeNearWhitePixels,
  scaleContentBoundsToTarget,
}
