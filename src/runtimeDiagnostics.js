function toDiagnosticLines(errorLike, context) {
  const lines = [`context: ${context}`]

  if (errorLike && typeof errorLike === 'object') {
    const name = typeof errorLike.name === 'string' ? errorLike.name.trim() : ''
    const message = typeof errorLike.message === 'string' ? errorLike.message.trim() : ''
    const stack = typeof errorLike.stack === 'string' ? errorLike.stack.trim() : ''

    if (name || message) {
      lines.push(`${name || 'Error'}: ${message || 'unknown error'}`)
    }

    if (stack) {
      lines.push(...stack.split('\n').slice(0, 8))
    }
  } else if (typeof errorLike === 'string' && errorLike.trim()) {
    lines.push(errorLike.trim())
  } else {
    lines.push('Unknown runtime error')
  }

  return lines
}

// 运行时异常必须在页面里可见，避免 uTools 里只剩一张白屏却没有任何调试线索。
export function renderRuntimeDiagnostic(documentLike = document, errorLike, context = 'runtime-error') {
  const body = documentLike?.body
  if (!body || typeof documentLike.createElement !== 'function') {
    return null
  }

  const diagnosticId = 'app-runtime-diagnostic'
  let diagnostic = documentLike.getElementById?.(diagnosticId) ?? null

  if (!diagnostic) {
    diagnostic = documentLike.createElement('section')
    diagnostic.id = diagnosticId
    diagnostic.setAttribute(
      'style',
      [
        'position:fixed',
        'inset:16px',
        'z-index:99999',
        'overflow:auto',
        'padding:16px',
        'border-radius:16px',
        'border:1px solid rgba(157,52,36,0.32)',
        'background:rgba(23,20,18,0.94)',
        'color:#f7f1ea',
        'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        'white-space:pre-wrap',
        'box-shadow:0 18px 40px rgba(0,0,0,0.35)',
      ].join(';'),
    )
    body.appendChild(diagnostic)
  }

  diagnostic.textContent = toDiagnosticLines(errorLike, context).join('\n')
  return diagnostic
}

// 启动链路和运行期都挂全局兜底，后续在 uTools 里白屏时至少能直接读到真实异常。
export function installRuntimeDiagnostics(targetWindow = window, documentLike = document) {
  const handleError = (event) => {
    renderRuntimeDiagnostic(documentLike, event?.error ?? event?.message, 'window-error')
  }

  const handleUnhandledRejection = (event) => {
    renderRuntimeDiagnostic(documentLike, event?.reason, 'unhandled-rejection')
  }

  targetWindow?.addEventListener?.('error', handleError)
  targetWindow?.addEventListener?.('unhandledrejection', handleUnhandledRejection)

  return () => {
    targetWindow?.removeEventListener?.('error', handleError)
    targetWindow?.removeEventListener?.('unhandledrejection', handleUnhandledRejection)
  }
}
