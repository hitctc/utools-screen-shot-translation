const WORKFLOW_CODES = {
  success: 'success',
  saveConfigInvalid: 'save-config-invalid',
  captureCancelled: 'capture-cancelled',
  translationFailed: 'translation-failed',
  pinFailed: 'pin-failed',
  saveFailed: 'save-failed',
}

// workflow 各步骤都约定用 ok 标记成败，这里统一判断上游依赖是否真的完成。
function isOkResult(result) {
  return !!result && typeof result === 'object' && result.ok === true
}

// 步骤如果已经给出了明确失败码，就不要再被主流程压扁成泛化错误。
function isFailureResult(result) {
  return !!result && typeof result === 'object' && result.ok === false && typeof result.code === 'string'
}

// 主流程只依赖保存开关和目录，这里先把 settings 压成当前阶段需要的最小形状。
function normalizeWorkflowSettings(settings) {
  const data = settings && typeof settings === 'object' ? settings : {}

  return {
    ...data,
    saveTranslatedImage: data.saveTranslatedImage === true,
    saveDirectory: typeof data.saveDirectory === 'string' ? data.saveDirectory.trim() : '',
  }
}

// 统一失败返回 shape，避免调用方再自己拼接 ok/code。
function buildFailure(code) {
  return {
    ok: false,
    code,
  }
}

// 每个步骤都统一把 reject/throw 收口成失败码，避免后续结果页接不到稳定的 code。
async function runWorkflowStep(step, failureCode, ...args) {
  try {
    const result = await step?.(...args)
    if (isOkResult(result)) {
      return result
    }

    return isFailureResult(result) ? result : buildFailure(failureCode)
  } catch {
    return buildFailure(failureCode)
  }
}

// 主流程只负责按顺序编排 capture -> translate -> pin -> save，不关心底层实现细节。
async function runMainWorkflow({
  settings,
  captureImage,
  translateImage,
  pinImage,
  saveImage,
} = {}) {
  const normalizedSettings = normalizeWorkflowSettings(settings)

  if (normalizedSettings.saveTranslatedImage && !normalizedSettings.saveDirectory) {
    return buildFailure(WORKFLOW_CODES.saveConfigInvalid)
  }

  const captureResult = await runWorkflowStep(captureImage, WORKFLOW_CODES.captureCancelled)
  if (!isOkResult(captureResult)) {
    return captureResult
  }

  const translationResult = await runWorkflowStep(translateImage, WORKFLOW_CODES.translationFailed, captureResult)
  if (!isOkResult(translationResult)) {
    return translationResult
  }

  const pinResult = await runWorkflowStep(pinImage, WORKFLOW_CODES.pinFailed, translationResult, captureResult)
  if (!isOkResult(pinResult)) {
    return pinResult
  }

  if (normalizedSettings.saveTranslatedImage) {
    const saveResult = await runWorkflowStep(
      saveImage,
      WORKFLOW_CODES.saveFailed,
      translationResult,
      pinResult,
    )
    if (!isOkResult(saveResult)) {
      return saveResult
    }
  }

  return {
    ok: true,
    code: WORKFLOW_CODES.success,
  }
}

module.exports = {
  WORKFLOW_CODES,
  runMainWorkflow,
}
