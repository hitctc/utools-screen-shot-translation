(function () {
  const services = window.services || null
  const PANEL_INIT_EVENT = 'screen-shot-translation:panel-init'
  const views = {
    records: $('#records-view'),
    settings: $('#settings-view'),
    result: $('#result-view'),
  }
  let panelState = {
    view: new URLSearchParams(window.location.search).get('view') || 'records',
    result: null,
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function showView(name) {
    Object.entries(views).forEach(([key, $view]) => {
      $view.prop('hidden', key !== name)
    })
    document.body.dataset.view = name
  }

  function mapFailureMessage(result) {
    switch (result?.code) {
      case 'capture-cancelled':
        return '截图已取消。'
      case 'translation-config-invalid':
        return '翻译凭证不完整，请先进入设置补全 AppID 和 Access Token。'
      case 'translation-failed':
        return '翻译失败，请重试。'
      case 'pin-failed':
        return '钉图失败，请重试。'
      case 'save-failed':
        return '保存失败，请检查保存目录。'
      default:
        return '发生未知错误。'
    }
  }

  function normalizeView(value) {
    switch (value) {
      case 'settings':
        return 'settings'
      case 'result':
        return 'result'
      case 'records':
      default:
        return 'records'
    }
  }

  function applyPanelState(nextState) {
    const candidate = nextState && typeof nextState === 'object' ? nextState : {}
    panelState = {
      view: normalizeView(candidate.view ?? panelState.view),
      result: candidate.result ?? panelState.result,
    }
    renderCurrentView()
  }

  function renderResult(result) {
    views.result.html(`
      <div class="shell">
        <section class="panel">
          <p class="panel__label">处理结果</p>
          <h1 class="panel__title">执行失败</h1>
          <p class="panel__copy">${escapeHtml(mapFailureMessage(result))}</p>
          <div class="actions">
            <button class="button button--primary" id="result-retry">重试</button>
            <button class="button" id="result-open-settings">进入设置</button>
            <button class="button" id="result-open-records">返回记录页</button>
          </div>
        </section>
      </div>
    `)
  }

  async function renderRecords() {
    const manifest = await services?.listSavedRecords?.()
    const records = Array.isArray(manifest?.records) ? manifest.records : []
    const listMarkup = records.length
      ? `<ul class="list">${records
          .map(
            (record) => `
              <li class="list__item" data-record-id="${escapeHtml(record.id || '')}">
                ${escapeHtml(record.id || '未命名记录')}
              </li>`,
          )
          .join('')}</ul>`
      : '<p class="panel__copy">当前还没有已保存的钉住记录。</p>'

    views.records.html(`
      <div class="shell">
        <section class="panel">
          <p class="panel__label">钉住记录</p>
          <h1 class="panel__title">钉住记录</h1>
          ${listMarkup}
          <div class="actions">
            <button class="button" id="records-open-settings">进入设置</button>
          </div>
        </section>
      </div>
    `)
  }

  function renderSettings() {
    const credentials = services?.getTranslationCredentials?.() || {}
    const pluginSettings = services?.getPluginSettings?.() || {}

    views.settings.html(`
      <div class="shell">
        <section class="panel">
          <p class="panel__label">设置</p>
          <h1 class="panel__title">设置</h1>
          <p class="panel__copy">AppID：${escapeHtml(credentials.appId || '未填写')}</p>
          <p class="panel__copy">Access Token：${credentials.accessToken ? '已填写' : '未填写'}</p>
          <p class="panel__copy">保存目录：${escapeHtml(pluginSettings.saveDirectory || '未设置')}</p>
          <div class="actions">
            <button class="button" id="settings-open-records">返回记录页</button>
          </div>
        </section>
      </div>
    `)
  }

  async function renderCurrentView() {
    if (panelState.view === 'settings') {
      renderSettings()
      showView('settings')
      return
    }

    if (panelState.view === 'result') {
      renderResult(panelState.result)
      showView('result')
      return
    }

    await renderRecords()
    showView('records')
  }

  $(document).on('click', '#result-retry', async () => {
    const result = await services?.runCaptureTranslationPin?.()
    if (result?.ok === false) {
      applyPanelState({ view: 'result', result })
      return
    }
    panelState.result = null
    panelState.view = 'records'
    await renderCurrentView()
  })

  $(document).on('click', '#result-open-settings, #records-open-settings', () => {
    applyPanelState({ view: 'settings', result: panelState.result })
  })

  $(document).on('click', '#result-open-records, #settings-open-records', () => {
    panelState.result = null
    applyPanelState({ view: 'records', result: null })
  })

  if (typeof window.addEventListener === 'function') {
    window.addEventListener(PANEL_INIT_EVENT, (event) => {
      applyPanelState(event.detail)
    })
  }

  if (window.__PANEL_INIT__) {
    applyPanelState(window.__PANEL_INIT__)
  } else {
    void renderCurrentView()
  }
})()
