const UNKNOWN_ENTER_TITLE = '未识别的入口指令'

export function createMainWorkflowResetState() {
  return {
    currentStep: 'capture',
    processing: false,
  }
}

export function createEmptyWorkflowResult() {
  return {
    visible: false,
    code: '',
    title: '',
    message: '',
  }
}

export function createUnknownPluginEnterResult(code) {
  return {
    visible: true,
    code: '',
    title: UNKNOWN_ENTER_TITLE,
    message: code ? `收到未知入口指令：${code}` : '收到空的入口指令。',
  }
}

export function resolveWorkflowResetTransition(nextView) {
  return {
    nextView,
    workflowResetState: createMainWorkflowResetState(),
    workflowResult: createEmptyWorkflowResult(),
  }
}

export function resolvePluginEnterTransition(code) {
  switch (code) {
    case 'screen-shot-translation-settings':
      return {
        ...resolveWorkflowResetTransition('settings'),
        refreshRecords: false,
      }
    case 'screen-shot-translation-records':
      return {
        ...resolveWorkflowResetTransition('records'),
        refreshRecords: true,
      }
    case 'screen-shot-translation-run':
      return {
        ...resolveWorkflowResetTransition('idle'),
        refreshRecords: false,
      }
    case undefined:
      return {
        ...resolveWorkflowResetTransition('records'),
        refreshRecords: false,
      }
    default:
      return {
        nextView: 'result',
        workflowResetState: null,
        workflowResult: createUnknownPluginEnterResult(code),
        refreshRecords: false,
      }
  }
}
