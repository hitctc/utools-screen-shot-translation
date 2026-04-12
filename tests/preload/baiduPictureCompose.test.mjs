import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const {
  composeTranslatedBlocksToPng,
} = require('../../public/preload/baiduPictureCompose.cjs')

test('composeTranslatedBlocksToPng accepts V2 string rect values from baidu docs', async () => {
  let rasterizePayload = null

  const result = await composeTranslatedBlocksToPng({
    captureImage: {
      imageBuffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0n8AAAAASUVORK5CYII=',
        'base64',
      ),
      imageDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0n8AAAAASUVORK5CYII=',
    },
    responseData: {
      contents: [
        {
          rect: '236,71,75,28',
          paste_img: 'YmxvY2stcGFzdGU=',
        },
      ],
    },
    rasterizeSvgImpl: async (payload) => {
      rasterizePayload = payload
      return 'Y29tcG9zZWQ='
    },
  })

  assert.equal(result?.ok, true)
  assert.equal(result?.translatedImageBase64, 'Y29tcG9zZWQ=')
  assert.equal(typeof rasterizePayload?.svgDataUrl, 'string')
  assert.match(rasterizePayload.svgDataUrl, /x%3D%22236%22/)
  assert.match(rasterizePayload.svgDataUrl, /y%3D%2271%22/)
  assert.match(rasterizePayload.svgDataUrl, /width%3D%2275%22/)
  assert.match(rasterizePayload.svgDataUrl, /height%3D%2228%22/)
})

test('composeTranslatedBlocksToPng can render translated text when V2 blocks do not include paste_img', async () => {
  let rasterizePayload = null

  const result = await composeTranslatedBlocksToPng({
    captureImage: {
      imageBuffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0n8AAAAASUVORK5CYII=',
        'base64',
      ),
      imageDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0n8AAAAASUVORK5CYII=',
    },
    responseData: {
      contents: [
        {
          rect: '0,0,240,48',
          dst: 'Modify hard pressed into the same submission.',
        },
      ],
    },
    rasterizeSvgImpl: async (payload) => {
      rasterizePayload = payload
      return 'dGV4dC1jb21wb3NlZA=='
    },
  })

  assert.equal(result?.ok, true)
  assert.equal(result?.translatedImageBase64, 'dGV4dC1jb21wb3NlZA==')
  assert.match(rasterizePayload.svgDataUrl, /Modifyhardpressedintothe/)
  assert.match(rasterizePayload.svgDataUrl, /samesubmission\./)
  assert.match(rasterizePayload.svgDataUrl, /%3Crect/)
  assert.match(rasterizePayload.svgDataUrl, /%3Ctext/)
  assert.doesNotMatch(rasterizePayload.svgDataUrl, /%3Cimage[^>]*data%3Aimage%2Fpng/)
  assert.doesNotMatch(rasterizePayload.svgDataUrl, /width%3D%22240%22/)
  assert.doesNotMatch(rasterizePayload.svgDataUrl, /height%3D%2248%22/)
})
