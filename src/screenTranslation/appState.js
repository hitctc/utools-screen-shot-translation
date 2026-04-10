import { createEmptyWorkflowResult } from './entryFlow.js'

export function createResetAppState(nextView) {
  return {
    currentView: nextView,
    currentStep: 'capture',
    processing: false,
    workflowResult: createEmptyWorkflowResult(),
  }
}

export function applyViewResetToAppState(currentState, nextView) {
  return {
    ...currentState,
    currentView: nextView,
    currentStep: 'capture',
    processing: false,
    workflowResult: createEmptyWorkflowResult(),
  }
}

export function applyPluginEnterTransitionToAppState(currentState, transition) {
  const nextState = applyViewResetToAppState(currentState, transition.nextView)

  if (transition.workflowResult.visible) {
    nextState.workflowResult = transition.workflowResult
  }

  return nextState
}
