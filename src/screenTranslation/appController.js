import {
  applyPluginEnterTransitionToAppState,
  applyViewResetToAppState,
} from './appState.js'
import { resolvePluginEnterTransition } from './entryFlow.js'

export function createScreenTranslationAppController({
  getState,
  setState,
  readPersistedState,
  refreshRecords,
}) {
  function syncState(nextState) {
    setState(nextState)
  }

  function handlePluginEnter({ code } = {}) {
    readPersistedState()

    const transition = resolvePluginEnterTransition(code)
    const currentState = getState()
    syncState(applyPluginEnterTransitionToAppState(currentState, transition))

    if (transition.refreshRecords) {
      refreshRecords()
    }
  }

  function goHome() {
    syncState(applyViewResetToAppState(getState(), 'home'))
  }

  function openSettings() {
    syncState(applyViewResetToAppState(getState(), 'settings'))
  }

  function runMainWorkflow() {
    syncState(applyViewResetToAppState(getState(), 'home'))
  }

  return {
    handlePluginEnter,
    goHome,
    openSettings,
    runMainWorkflow,
  }
}
