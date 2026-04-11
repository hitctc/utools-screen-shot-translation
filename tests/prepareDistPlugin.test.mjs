import test from 'node:test'
import assert from 'node:assert/strict'
import { toReleasePluginManifest } from '../scripts/prepare-dist-plugin.mjs'

test('toReleasePluginManifest removes the development block but keeps release fields intact', () => {
  const manifest = {
    main: 'index.html',
    preload: 'preload/services.js',
    logo: 'logo.png',
    development: {
      main: 'http://127.0.0.1:5173/index.html',
    },
    features: [
      {
        code: 'screen-shot-translation-run',
        cmds: ['截屏翻译钉住'],
      },
    ],
  }

  assert.deepEqual(toReleasePluginManifest(manifest), {
    main: 'index.html',
    preload: 'preload/services.js',
    logo: 'logo.png',
    features: [
      {
        code: 'screen-shot-translation-run',
        cmds: ['截屏翻译钉住'],
      },
    ],
  })
})
