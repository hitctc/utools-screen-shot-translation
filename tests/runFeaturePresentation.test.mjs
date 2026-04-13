import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const pluginJsonPath = fileURLToPath(new URL('../public/plugin.json', import.meta.url))

test('template plugin run feature does not declare a custom main page shell', () => {
  const pluginManifest = JSON.parse(readFileSync(pluginJsonPath, 'utf8'))
  const runFeature = pluginManifest.features.find((feature) => feature.code === 'screen-shot-translation-peg-run')

  assert.equal(Object.prototype.hasOwnProperty.call(pluginManifest, 'main'), false)
  assert.equal(runFeature?.mainHide, true)
})

test('template plugin run feature is expected to be provided by preload window.exports', () => {
  const pluginManifest = JSON.parse(readFileSync(pluginJsonPath, 'utf8'))

  assert.deepEqual(
    pluginManifest.features.map((feature) => feature.code),
    [
      'screen-shot-translation-peg-run',
      'screen-shot-translation-peg-records',
      'screen-shot-translation-settings',
    ],
  )
})
