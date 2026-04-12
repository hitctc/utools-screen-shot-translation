import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildStaticPlugin } from '../scripts/build-static-plugin.mjs'

test('buildStaticPlugin copies the public plugin manifest as-is into dist', () => {
  buildStaticPlugin()

  const publicManifest = JSON.parse(fs.readFileSync(path.resolve('public/plugin.json'), 'utf8'))
  const distManifest = JSON.parse(fs.readFileSync(path.resolve('dist/plugin.json'), 'utf8'))

  assert.deepEqual(distManifest, publicManifest)
})
