import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const pluginJsonPath = fileURLToPath(new URL('../public/plugin.json', import.meta.url))
const appVuePath = fileURLToPath(new URL('../src/App.vue', import.meta.url))

test('run feature keeps the uTools main window hidden while starting capture', () => {
  const pluginManifest = JSON.parse(readFileSync(pluginJsonPath, 'utf8'))
  const runFeature = pluginManifest.features.find((feature) => feature.code === 'screen-shot-translation-run')

  assert.equal(runFeature?.mainHide, true)
})

test('App idle view does not fall through to the result page shell', () => {
  const appSource = readFileSync(appVuePath, 'utf8')

  assert.match(appSource, /v-else-if="currentView === 'idle'"/)
  assert.match(appSource, /<ResultView\s+[\s\S]*v-else-if="currentView === 'result'"/)
})
