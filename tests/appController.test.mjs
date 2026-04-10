import assert from 'node:assert/strict'
import test from 'node:test'

import { createScreenTranslationAppController } from '../src/screenTranslation/appController.js'

function createHarness(initialState) {
  const state = structuredClone(initialState)
  const calls = {
    readPersistedState: 0,
    refreshRecords: 0,
  }

  const controller = createScreenTranslationAppController({
    getState: () => state,
    setState: (nextState) => {
      state.currentView = nextState.currentView
      state.currentStep = nextState.currentStep
      state.processing = nextState.processing
      state.workflowResult = structuredClone(nextState.workflowResult)
    },
    readPersistedState: () => {
      calls.readPersistedState += 1
    },
    refreshRecords: () => {
      calls.refreshRecords += 1
    },
  })

  return { controller, state, calls }
}

test('goHome and openSettings reset a dirty app state back to capture before switching views', () => {
  const { controller, state } = createHarness({
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

  controller.goHome()

  assert.deepEqual(state, {
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

  state.currentView = 'result'
  state.currentStep = 'translate'
  state.processing = true
  state.workflowResult = {
    visible: true,
    code: 'translation-failed',
    title: '旧状态',
    message: '这里是脏态。',
  }

  controller.openSettings()

  assert.deepEqual(state, {
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
})

test('handlePluginEnter consumes the App controller path for run, records, settings and unknown codes', () => {
  const { controller, state, calls } = createHarness({
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

  controller.handlePluginEnter({ code: 'screen-shot-translation-run' })

  assert.deepEqual(state, {
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
  assert.equal(calls.readPersistedState, 1)
  assert.equal(calls.refreshRecords, 0)

  state.currentView = 'result'
  state.currentStep = 'pin'
  state.processing = true
  state.workflowResult = {
    visible: true,
    code: 'pin-failed',
    title: '旧状态',
    message: '这里是脏态。',
  }

  controller.handlePluginEnter({ code: 'screen-shot-translation-records' })

  assert.deepEqual(state, {
    currentView: 'records',
    currentStep: 'capture',
    processing: false,
    workflowResult: {
      visible: false,
      code: '',
      title: '',
      message: '',
    },
  })
  assert.equal(calls.readPersistedState, 2)
  assert.equal(calls.refreshRecords, 1)

  state.currentView = 'result'
  state.currentStep = 'translate'
  state.processing = true
  state.workflowResult = {
    visible: true,
    code: 'translation-failed',
    title: '旧状态',
    message: '这里是脏态。',
  }

  controller.handlePluginEnter({ code: 'screen-shot-translation-settings' })

  assert.deepEqual(state, {
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
  assert.equal(calls.readPersistedState, 3)
  assert.equal(calls.refreshRecords, 1)

  state.currentView = 'result'
  state.currentStep = 'translate'
  state.processing = true
  state.workflowResult = {
    visible: true,
    code: 'translation-failed',
    title: '旧状态',
    message: '这里是脏态。',
  }

  controller.handlePluginEnter({ code: 'screen-shot-translation-unknown' })

  assert.deepEqual(state, {
    currentView: 'result',
    currentStep: 'capture',
    processing: false,
    workflowResult: {
      visible: true,
      code: '',
      title: '未识别的入口指令',
      message: '收到未知入口指令：screen-shot-translation-unknown',
    },
  })
  assert.equal(calls.readPersistedState, 4)
  assert.equal(calls.refreshRecords, 1)
})

test('runMainWorkflow keeps the home route on a clean capture state', () => {
  const { controller, state } = createHarness({
    currentView: 'records',
    currentStep: 'pin',
    processing: true,
    workflowResult: {
      visible: true,
      code: 'pin-failed',
      title: '旧状态',
      message: '这里是脏态。',
    },
  })

  controller.runMainWorkflow()

  assert.deepEqual(state, {
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
})
