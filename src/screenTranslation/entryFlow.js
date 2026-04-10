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

export function resolvePluginEnterTransition(code) {
  switch (code) {
    case 'screen-shot-translation-settings':
      return {
        nextView: 'settings',
        workflowResetState: createMainWorkflowResetState(),
        workflowResult: createEmptyWorkflowResult(),
        refreshRecords: false,
      }
    case 'screen-shot-translation-records':
      return {
        nextView: 'records',
        workflowResetState: createMainWorkflowResetState(),
        workflowResult: createEmptyWorkflowResult(),
        refreshRecords: true,
      }
    case 'screen-shot-translation-run':
    case undefined:
      return {
        nextView: 'home',
        workflowResetState: createMainWorkflowResetState(),
        workflowResult: createEmptyWorkflowResult(),
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
