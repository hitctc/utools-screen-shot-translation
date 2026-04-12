import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createMainWorkflowResetState,
  createUnknownPluginEnterResult,
  resolvePluginEnterTransition,
  resolveWorkflowResetTransition,
} from '../src/screenTranslation/entryFlow.js'

const pluginJsonPath = fileURLToPath(new URL('../public/plugin.json', import.meta.url))
const pluginManifest = JSON.parse(readFileSync(pluginJsonPath, 'utf8'))

test('resolvePluginEnterTransition maps feature codes to the expected views and reset state', () => {
  const runTransition = resolvePluginEnterTransition('screen-shot-translation-run')
  const settingsTransition = resolvePluginEnterTransition('screen-shot-translation-settings')
  const recordsTransition = resolvePluginEnterTransition('screen-shot-translation-records')
  const defaultTransition = resolvePluginEnterTransition(undefined)

  assert.equal(runTransition.nextView, 'idle')
  assert.deepEqual(runTransition.workflowResetState, createMainWorkflowResetState())
  assert.deepEqual(runTransition.workflowResult, {
    visible: false,
    code: '',
    title: '',
    message: '',
  })
  assert.equal(runTransition.refreshRecords, false)

  assert.equal(settingsTransition.nextView, 'settings')
  assert.deepEqual(settingsTransition.workflowResetState, createMainWorkflowResetState())
  assert.equal(settingsTransition.refreshRecords, false)

  assert.equal(recordsTransition.nextView, 'records')
  assert.deepEqual(recordsTransition.workflowResetState, createMainWorkflowResetState())
  assert.equal(recordsTransition.refreshRecords, true)

  assert.equal(defaultTransition.nextView, 'records')
  assert.deepEqual(defaultTransition.workflowResetState, createMainWorkflowResetState())
  assert.equal(defaultTransition.refreshRecords, false)
})

test('settings and records transitions always reset the main workflow back to capture', () => {
  const settingsTransition = resolvePluginEnterTransition('screen-shot-translation-settings')
  const recordsTransition = resolvePluginEnterTransition('screen-shot-translation-records')

  assert.equal(settingsTransition.workflowResetState.currentStep, 'capture')
  assert.equal(settingsTransition.workflowResetState.processing, false)
  assert.equal(recordsTransition.workflowResetState.currentStep, 'capture')
  assert.equal(recordsTransition.workflowResetState.processing, false)
})

test('unknown plugin enter code resolves to result state with an explicit message', () => {
  const transition = resolvePluginEnterTransition('screen-shot-translation-unknown')

  assert.equal(transition.nextView, 'result')
  assert.equal(transition.workflowResetState, null)
  assert.deepEqual(transition.workflowResult, createUnknownPluginEnterResult('screen-shot-translation-unknown'))
})

test('plugin manifest feature codes stay aligned with the entry flow dispatcher', () => {
  const manifestCodes = pluginManifest.features.map((feature) => feature.code)

  assert.deepEqual(manifestCodes, [
    'screen-shot-translation-run',
    'screen-shot-translation-records',
    'screen-shot-translation-settings',
  ])

  for (const code of manifestCodes) {
    const transition = resolvePluginEnterTransition(code)

    assert.notEqual(transition.nextView, 'result')
    assert.equal(transition.workflowResetState.currentStep, 'capture')
    assert.equal(transition.workflowResetState.processing, false)
  }
})

test('go-home and open-settings style transitions both reset to capture before switching views', () => {
  const homeTransition = resolveWorkflowResetTransition('home')
  const settingsTransition = resolveWorkflowResetTransition('settings')

  assert.equal(homeTransition.nextView, 'home')
  assert.equal(settingsTransition.nextView, 'settings')
  assert.deepEqual(homeTransition.workflowResetState, createMainWorkflowResetState())
  assert.deepEqual(settingsTransition.workflowResetState, createMainWorkflowResetState())
  assert.deepEqual(homeTransition.workflowResult, {
    visible: false,
    code: '',
    title: '',
    message: '',
  })
  assert.deepEqual(settingsTransition.workflowResult, {
    visible: false,
    code: '',
    title: '',
    message: '',
  })
})
