import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyPluginEnterTransitionToAppState,
  applyViewResetToAppState,
  createResetAppState,
} from '../src/screenTranslation/appState.js'
import { resolvePluginEnterTransition } from '../src/screenTranslation/entryFlow.js'

test('reset transitions always return to capture before switching views', () => {
  const dirtyState = {
    currentView: 'result',
    currentStep: 'pin',
    processing: true,
    workflowResult: {
      visible: true,
      code: 'pin-failed',
      title: '旧状态',
      message: '这里是脏态。',
    },
  }

  const homeState = applyViewResetToAppState(dirtyState, 'home')
  const settingsState = applyViewResetToAppState(dirtyState, 'settings')

  assert.deepEqual(homeState, {
    currentView: 'home',
    currentStep: 'capture',
    processing: false,
    workflowResult: {
      visible: false,
      code: '',
      title: '',
      message: '',
    },
  })

  assert.deepEqual(settingsState, {
    currentView: 'settings',
    currentStep: 'capture',
    processing: false,
    workflowResult: {
      visible: false,
      code: '',
      title: '',
      message: '',
    },
  })

  assert.deepEqual(dirtyState, {
    currentView: 'result',
    currentStep: 'pin',
    processing: true,
    workflowResult: {
      visible: true,
      code: 'pin-failed',
      title: '旧状态',
      message: '这里是脏态。',
    },
  })
})

test('plugin enter transitions flow through the same app state adapter that App.vue uses', () => {
  const dirtyState = {
    currentView: 'result',
    currentStep: 'translate',
    processing: true,
    workflowResult: {
      visible: true,
      code: 'translation-failed',
      title: '旧状态',
      message: '这里是脏态。',
    },
  }

  const runState = applyPluginEnterTransitionToAppState(
    dirtyState,
    resolvePluginEnterTransition('screen-shot-translation-run'),
  )
  const recordsState = applyPluginEnterTransitionToAppState(
    dirtyState,
    resolvePluginEnterTransition('screen-shot-translation-records'),
  )
  const settingsState = applyPluginEnterTransitionToAppState(
    dirtyState,
    resolvePluginEnterTransition('screen-shot-translation-settings'),
  )
  const unknownState = applyPluginEnterTransitionToAppState(
    dirtyState,
    resolvePluginEnterTransition('screen-shot-translation-unknown'),
  )

  assert.deepEqual(runState, createResetAppState('home'))
  assert.deepEqual(recordsState, createResetAppState('records'))
  assert.deepEqual(settingsState, createResetAppState('settings'))
  assert.equal(unknownState.currentView, 'result')
  assert.equal(unknownState.currentStep, 'capture')
  assert.equal(unknownState.processing, false)
  assert.equal(unknownState.workflowResult.visible, true)
  assert.equal(unknownState.workflowResult.title, '未识别的入口指令')
  assert.deepEqual(dirtyState, {
    currentView: 'result',
    currentStep: 'translate',
    processing: true,
    workflowResult: {
      visible: true,
      code: 'translation-failed',
      title: '旧状态',
      message: '这里是脏态。',
    },
  })
})
