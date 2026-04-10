import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMainWorkflowResetState,
  createUnknownPluginEnterResult,
  resolvePluginEnterTransition,
} from '../src/screenTranslation/entryFlow.js'

test('resolvePluginEnterTransition maps feature codes to the expected views and reset state', () => {
  const runTransition = resolvePluginEnterTransition('screen-shot-translation-run')
  const settingsTransition = resolvePluginEnterTransition('screen-shot-translation-settings')
  const recordsTransition = resolvePluginEnterTransition('screen-shot-translation-records')

  assert.equal(runTransition.nextView, 'home')
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
