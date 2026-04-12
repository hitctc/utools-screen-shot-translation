import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  removeEdgeNearWhitePixels,
  findVisibleContentBounds,
  scaleContentBoundsToTarget,
} = require('../../public/preload/pinImageMask.cjs')

function createImageData(width, height, fillPixel) {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const [red, green, blue, alpha] = fillPixel(x, y)
      data[offset] = red
      data[offset + 1] = green
      data[offset + 2] = blue
      data[offset + 3] = alpha
    }
  }

  return data
}

test('removeEdgeNearWhitePixels clears a white frame connected to image edges', () => {
  const input = createImageData(4, 4, (x, y) => {
    if (x === 0 || y === 0 || x === 3 || y === 3) {
      return [255, 255, 255, 255]
    }

    return [20, 20, 20, 255]
  })

  const output = removeEdgeNearWhitePixels({ data: input, width: 4, height: 4 })

  assert.equal(output[3], 0)
  assert.equal(output[(4 * 4 - 1) * 4 + 3], 0)
  assert.equal(output[(1 * 4 + 1) * 4 + 3], 255)
})

test('removeEdgeNearWhitePixels removes an off-white background but keeps dark text pixels', () => {
  const input = createImageData(5, 5, (x, y) => {
    if (x === 2 && y >= 1 && y <= 3) {
      return [24, 24, 24, 255]
    }

    return [238, 238, 238, 255]
  })

  const output = removeEdgeNearWhitePixels({ data: input, width: 5, height: 5 })
  const backgroundAlpha = output[(0 * 5 + 0) * 4 + 3]
  const textAlpha = output[(2 * 5 + 2) * 4 + 3]

  assert.equal(backgroundAlpha, 0)
  assert.equal(textAlpha, 255)
})

test('removeEdgeNearWhitePixels keeps non-white light content visible', () => {
  const input = createImageData(3, 3, (x, y) => {
    if (x === 1 && y === 1) {
      return [228, 228, 228, 255]
    }

    return [255, 255, 255, 255]
  })

  const output = removeEdgeNearWhitePixels({ data: input, width: 3, height: 3 })
  const centerAlpha = output[(1 * 3 + 1) * 4 + 3]

  assert.equal(centerAlpha, 255)
})

test('findVisibleContentBounds returns the bounding box of centered content on a large white canvas', () => {
  const input = createImageData(8, 6, (x, y) => {
    if (x >= 2 && x <= 5 && y >= 1 && y <= 4) {
      return [30, 30, 30, 255]
    }

    return [244, 244, 244, 255]
  })

  const cleaned = removeEdgeNearWhitePixels({ data: input, width: 8, height: 6 })
  const bounds = findVisibleContentBounds({
    data: cleaned,
    width: 8,
    height: 6,
  })

  assert.deepEqual(bounds, {
    x: 1,
    y: 0,
    width: 6,
    height: 6,
  })
})

test('findVisibleContentBounds keeps a tight padded box around thin content after edge cleanup', () => {
  const input = createImageData(12, 8, (x, y) => {
    if (x === 5 && y >= 2 && y <= 5) {
      return [24, 24, 24, 255]
    }

    return [244, 244, 244, 255]
  })

  const cleaned = removeEdgeNearWhitePixels({ data: input, width: 12, height: 8 })
  const bounds = findVisibleContentBounds({
    data: cleaned,
    width: 12,
    height: 8,
  })

  assert.deepEqual(bounds, {
    x: 4,
    y: 1,
    width: 3,
    height: 6,
  })
})

test('scaleContentBoundsToTarget converts natural image bounds into the current rendered content bounds', () => {
  const scaled = scaleContentBoundsToTarget({
    sourceWidth: 400,
    sourceHeight: 200,
    targetWidth: 200,
    targetHeight: 100,
    bounds: {
      x: 20,
      y: 40,
      width: 300,
      height: 100,
    },
  })

  assert.deepEqual(scaled, {
    x: 10,
    y: 20,
    width: 150,
    height: 50,
  })
})
