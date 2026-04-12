const TRANSLATION_CREDENTIALS_DOC_ID = 'screen-shot-translation/translation-credentials'

// 百度凭证只接受字符串字段，读写时统一 trim，避免同步文档里残留脏空格。
function normalizeTranslationCredentials(raw) {
  const candidate = raw && typeof raw === 'object' ? raw : {}

  return {
    appId: typeof candidate.appId === 'string' ? candidate.appId.trim() : '',
    accessToken: typeof candidate.accessToken === 'string' ? candidate.accessToken.trim() : '',
  }
}

// 读取同步文档时只向上层暴露凭证字段，不让 _id / _rev 泄漏到渲染层。
function getTranslationCredentials(db) {
  if (!db || typeof db.get !== 'function') {
    return normalizeTranslationCredentials(null)
  }

  return normalizeTranslationCredentials(db.get(TRANSLATION_CREDENTIALS_DOC_ID))
}

// 保存时先带上旧文档的 _rev，保证多设备同步场景仍走 uTools 的版本控制。
function saveTranslationCredentials(db, partial) {
  const currentDoc = db && typeof db.get === 'function' ? db.get(TRANSLATION_CREDENTIALS_DOC_ID) : null
  const current = normalizeTranslationCredentials(currentDoc)
  const patch = partial && typeof partial === 'object' ? partial : {}
  const next = {
    appId: typeof patch.appId === 'string' ? patch.appId.trim() : current.appId,
    accessToken: typeof patch.accessToken === 'string' ? patch.accessToken.trim() : current.accessToken,
  }

  if (!db || typeof db.get !== 'function' || typeof db.put !== 'function') {
    return next
  }

  const saveResult = db.put({
    _id: TRANSLATION_CREDENTIALS_DOC_ID,
    ...(currentDoc && typeof currentDoc._rev === 'string' ? { _rev: currentDoc._rev } : {}),
    ...next,
    updatedAt: new Date().toISOString(),
  })

  if (saveResult && saveResult.ok !== true && saveResult.error === true) {
    return normalizeTranslationCredentials(currentDoc)
  }

  return next
}

module.exports = {
  TRANSLATION_CREDENTIALS_DOC_ID,
  normalizeTranslationCredentials,
  getTranslationCredentials,
  saveTranslationCredentials,
}
