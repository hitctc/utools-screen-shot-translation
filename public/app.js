(function () {
  const services = window.services || {}
  const panelStateApi = window.ScreenTranslationPanelState || {}
  const PANEL_INIT_EVENT = 'screen-shot-translation:panel-init'
  const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'
  const views = {
    records: $('#records-view'),
    settings: $('#settings-view'),
    result: $('#result-view'),
  }
  const state = {
    view: new URLSearchParams(window.location.search).get('view') || 'records',
    result: null,
    uiSettings: panelStateApi.DEFAULT_UI_SETTINGS || {},
    pluginSettings: panelStateApi.DEFAULT_PLUGIN_SETTINGS || {},
    translationCredentials: panelStateApi.DEFAULT_TRANSLATION_CREDENTIALS || {},
    records: [],
    loadingRecords: false,
    warning: '',
    prefersDark: false,
  }

  // 统一刷新本地快照，避免 records/settings 各自读一份旧状态。
  function readSnapshot() {
    state.uiSettings = panelStateApi.normalizeUiSettings?.(services.getUiSettings?.()) || state.uiSettings
    state.pluginSettings =
      panelStateApi.normalizePluginSettings?.(services.getPluginSettings?.()) || state.pluginSettings
    state.translationCredentials =
      panelStateApi.normalizeTranslationCredentials?.(services.getTranslationCredentials?.()) ||
      state.translationCredentials
  }

  function escapeHtml(value) {
    return panelStateApi.escapeHtml ? panelStateApi.escapeHtml(value) : String(value ?? '')
  }

  function themeStatus() {
    return panelStateApi.formatThemeStatus
      ? panelStateApi.formatThemeStatus(state.uiSettings.themeMode, state.prefersDark)
      : '跟随系统 / 浅色'
  }

  function applyTheme() {
    const nextTheme = panelStateApi.resolveTheme
      ? panelStateApi.resolveTheme(state.uiSettings.themeMode, state.prefersDark)
      : 'light'
    document.documentElement.dataset.theme = nextTheme
  }

  function showView(name) {
    Object.entries(views).forEach(([key, $view]) => {
      $view.prop('hidden', key !== name)
    })
    document.body.dataset.view = name
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

  function switchView(view, result) {
    state.view = normalizeView(view)
    state.result = result ?? null
    void renderCurrentView()
  }

  function resultPresentation() {
    return panelStateApi.mapWorkflowFailureToResult?.(state.result?.code) || {
      title: '这次没有完成钉住',
      message: '流程执行失败，请重试。',
      showRetry: true,
      showOpenSettings: false,
      showClose: true,
    }
  }

  function renderInfoStrip(label, value) {
    return `
      <div class="info-strip">
        <span class="info-strip__label">${escapeHtml(label)}</span>
        <span class="info-strip__value">${escapeHtml(value)}</span>
      </div>
    `
  }

  function renderRecordsColumns() {
    const columnCount = state.uiSettings.recordsColumnCount
    const mappedRecords = state.records
      .map((record, index) =>
        panelStateApi.mapSavedRecordToViewRecord?.(record, index, state.pluginSettings.saveDirectory),
      )
      .filter(Boolean)
    const columns = panelStateApi.splitRecordsIntoVisualColumns
      ? panelStateApi.splitRecordsIntoVisualColumns(mappedRecords, columnCount)
      : [mappedRecords]

    return `
      <section class="records-grid" style="--records-column-count:${columns.length || 1}" aria-label="钉住记录列表">
        ${columns
          .map(
            (columnRecords, columnIndex) => `
              <div class="records-grid__column" data-column-index="${columnIndex}">
                ${columnRecords
                  .map(
                    (record) => `
                      <article class="record-card" data-record-id="${escapeHtml(record.id)}">
                        <button type="button" class="record-card__preview" data-action="repin-record" data-record-id="${escapeHtml(record.id)}">
                          <img class="record-card__image" src="${escapeHtml(record.imagePath)}" alt="${escapeHtml(record.orderLabel)}" />
                          <span class="record-card__overlay">
                            <span class="record-card__order">${escapeHtml(record.orderLabel)}</span>
                            <span class="record-card__action">重钉</span>
                          </span>
                        </button>
                        <div class="record-card__meta">
                          <span>${escapeHtml(record.orderLabel)}</span>
                          <span>${escapeHtml(record.createdAtLabel)}</span>
                        </div>
                        <div class="record-card__actions">
                          <button type="button" class="secondary-button secondary-button--compact" data-action="repin-record" data-record-id="${escapeHtml(record.id)}">重新钉住</button>
                          <button type="button" class="secondary-button secondary-button--compact secondary-button--danger" data-action="delete-record" data-record-id="${escapeHtml(record.id)}">删除</button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            `,
          )
          .join('')}
      </section>
    `
  }

  function renderRecordsEmptyState() {
    const emptyState = panelStateApi.buildRecordsEmptyState
      ? panelStateApi.buildRecordsEmptyState(state.pluginSettings)
      : {
          title: '当前没有记录',
          copy: '完成一次截屏翻译并保存后，这里会出现记录。',
        }

    return `
      <section class="empty-state">
        <p class="section-label">暂无记录</p>
        <h2>${escapeHtml(emptyState.title)}</h2>
        <p class="empty-state__copy">${escapeHtml(emptyState.copy)}</p>
      </section>
    `
  }

  async function renderRecords() {
    readSnapshot()
    const warning = state.warning || panelStateApi.getSaveDirectoryWarning?.(state.pluginSettings) || ''
    const shellMarkup = `
      <section class="page-shell page-shell--records">
        <header class="hero-card hero-card--compact">
          <div class="hero-card__eyebrow">
            <p class="section-label">钉住记录</p>
            <span class="status-chip">${escapeHtml(themeStatus())}</span>
          </div>
          <h1>钉住记录</h1>
          <p class="hero-copy">点击缩略图会按最后位置重新钉住，删除会按设置里的确认开关执行。</p>
          <div class="records-toolbar">
            <div class="records-toolbar__meta">
              <span class="section-label">记录总数</span>
              <strong class="records-toolbar__count">${state.records.length} 条</strong>
            </div>
            <label class="records-toolbar__density" for="records-column-count">
              <span class="records-toolbar__density-label">列数</span>
              <input
                id="records-column-count"
                class="records-toolbar__slider"
                type="range"
                min="${panelStateApi.RECORDS_COLUMN_COUNT_MIN || 3}"
                max="${panelStateApi.RECORDS_COLUMN_COUNT_MAX || 6}"
                step="1"
                value="${state.uiSettings.recordsColumnCount}"
              />
              <span class="records-toolbar__density-value">${state.uiSettings.recordsColumnCount} 列</span>
            </label>
            ${renderInfoStrip('当前排布', `${state.uiSettings.recordsColumnCount} 列瀑布流`)}
          </div>
        </header>
        ${warning ? `<p class="state-card state-card--error">${escapeHtml(warning)}</p>` : ''}
        ${
          state.loadingRecords
            ? `<section class="state-card state-card--hint"><p class="section-label">正在加载</p><p>正在整理记录列表，请稍候。</p></section>`
            : state.records.length
              ? renderRecordsColumns()
              : renderRecordsEmptyState()
        }
        <div class="records-floating-action">
          <button type="button" class="secondary-button records-floating-action__button" id="records-open-settings">设置</button>
        </div>
      </section>
    `

    views.records.html(shellMarkup)
    showView('records')
  }

  function renderSettings() {
    readSnapshot()
    const saveDirectoryWarning = panelStateApi.getSaveDirectoryWarning?.(state.pluginSettings) || ''
    const translationCredentialWarning =
      panelStateApi.getTranslationCredentialWarning?.(state.translationCredentials) || ''
    const currentTranslationMode =
      (panelStateApi.TRANSLATION_MODE_OPTIONS || []).find(
        (option) => option.value === state.pluginSettings.translationMode,
      )?.label || state.pluginSettings.translationMode
    const hasSaveDirectory = Boolean(state.pluginSettings.saveDirectory.trim())

    views.settings.html(`
      <section class="page-shell page-shell--settings">
        <header class="settings-card settings-card--hero">
          <div class="hero-card__eyebrow">
            <p class="section-label">设置</p>
            <span class="status-chip">${escapeHtml(themeStatus())}</span>
          </div>
          <h1>设置</h1>
          <p class="settings-copy">这里集中管理翻译、保存和界面配置。</p>
        </header>

        <section class="settings-grid">
          <article class="settings-card">
            <div class="settings-card__header">
              <div>
                <p class="group-title">翻译凭证</p>
                <p class="group-copy">当前只使用百度图片翻译 V2，请同时填写 AppID 和 Access Token。</p>
                <div class="resource-links" aria-label="百度图片翻译相关链接">
                  <a class="resource-link" href="https://fanyi-api.baidu.com/product/233" data-action="open-resource-link" data-url="https://fanyi-api.baidu.com/product/233">图片翻译 V2.0 文档</a>
                  <a class="resource-link" href="https://fanyi-api.baidu.com/" data-action="open-resource-link" data-url="https://fanyi-api.baidu.com/">申请百度翻译开放平台</a>
                </div>
              </div>
            </div>
            ${renderInfoStrip('当前状态', state.translationCredentials.appId && state.translationCredentials.accessToken ? 'V2 已启用' : '未配置')}
            <label class="field">
              <span class="field__label">百度 AppID</span>
              <input id="credential-app-id" class="field__control" type="text" value="${escapeHtml(state.translationCredentials.appId)}" placeholder="V2 需要 AppID" />
            </label>
            <label class="field">
              <span class="field__label">百度 Access Token</span>
              <input id="credential-access-token" class="field__control" type="password" value="${escapeHtml(state.translationCredentials.accessToken)}" placeholder="需要与 AppID 配合使用" />
            </label>
            ${
              translationCredentialWarning
                ? `<p class="field__hint field__hint--warning">${escapeHtml(translationCredentialWarning)}</p>`
                : ''
            }
          </article>

          <article class="settings-card">
            <div class="settings-card__header">
              <div>
                <p class="group-title">翻译方向</p>
                <p class="group-copy">控制当前截图结果的翻译方向。</p>
              </div>
            </div>
            ${renderInfoStrip('当前方向', currentTranslationMode)}
            <label class="field">
              <span class="field__label">翻译方向</span>
              <select id="translation-mode" class="field__control field__control--select">
                ${(panelStateApi.TRANSLATION_MODE_OPTIONS || [])
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.value)}"${option.value === state.pluginSettings.translationMode ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
          </article>

          <article class="settings-card">
            <div class="settings-card__header">
              <div>
                <p class="group-title">结果保存</p>
                <p class="group-copy">保存开关和目录一起组成有效配置，目录可以手动输入，也可以通过系统选择器填写。</p>
              </div>
            </div>
            ${renderInfoStrip('当前状态', state.pluginSettings.saveTranslatedImage ? '已开启' : '已关闭')}
            <label class="field field--inline">
              <input id="save-translated-image" type="checkbox"${state.pluginSettings.saveTranslatedImage ? ' checked' : ''} />
              <span class="field__label">保存翻译结果</span>
            </label>
            <label class="field">
              <span class="field__label">保存目录</span>
              <input id="save-directory" class="field__control" type="text" value="${escapeHtml(state.pluginSettings.saveDirectory)}" placeholder="/Users/you/Pictures/translation" />
            </label>
            <div class="actions-row">
              <button type="button" class="secondary-button secondary-button--compact" id="settings-pick-directory">选择保存目录</button>
              <button type="button" class="secondary-button secondary-button--compact"${hasSaveDirectory ? '' : ' disabled'} id="settings-open-directory">打开目录</button>
            </div>
            ${
              saveDirectoryWarning
                ? `<p class="field__hint field__hint--warning">${escapeHtml(saveDirectoryWarning)}</p>`
                : ''
            }
          </article>

          <article class="settings-card">
            <div class="settings-card__header">
              <div>
                <p class="group-title">删除行为</p>
                <p class="group-copy">控制删除记录时是否先弹出确认提示。</p>
              </div>
            </div>
            ${renderInfoStrip('当前状态', state.pluginSettings.confirmBeforeDelete ? '需要确认' : '直接删除')}
            <label class="field field--inline">
              <input id="confirm-before-delete" type="checkbox"${state.pluginSettings.confirmBeforeDelete ? ' checked' : ''} />
              <span class="field__label">删除前确认</span>
            </label>
          </article>

          <article class="settings-card">
            <div class="settings-card__header">
              <div>
                <p class="group-title">界面偏好</p>
                <p class="group-copy">主题和窗口高度会保存在同一份界面设置里。</p>
              </div>
            </div>
            ${renderInfoStrip('当前主题', themeStatus())}
            <label class="field">
              <span class="field__label">主题模式</span>
              <select id="theme-mode" class="field__control field__control--select">
                ${(panelStateApi.THEME_OPTIONS || [])
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.value)}"${option.value === state.uiSettings.themeMode ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="field">
              <span class="field__label">窗口高度: ${state.uiSettings.windowHeight} px</span>
              <input
                id="window-height"
                class="range-control"
                type="range"
                min="${panelStateApi.WINDOW_HEIGHT_MIN || 480}"
                max="${panelStateApi.WINDOW_HEIGHT_MAX || 960}"
                step="${panelStateApi.WINDOW_HEIGHT_STEP || 20}"
                value="${state.uiSettings.windowHeight}"
              />
            </label>
            <div class="range-meta">
              <span>${panelStateApi.WINDOW_HEIGHT_MIN || 480} px</span>
              <span>${panelStateApi.WINDOW_HEIGHT_MAX || 960} px</span>
            </div>
            <div class="actions-row">
              <button type="button" class="secondary-button secondary-button--compact" id="settings-reset-height">恢复默认高度</button>
            </div>
          </article>
        </section>

        <div class="settings-floating-action">
          <button type="button" class="secondary-button settings-floating-action__button" id="settings-open-records">返回记录页</button>
        </div>
      </section>
    `)

    showView('settings')
  }

  function renderResult() {
    readSnapshot()
    const presentation = resultPresentation()
    const code = state.result?.code || 'workflow'

    views.result.html(`
      <section class="page-shell page-shell--result">
        <header class="result-card">
          <div class="hero-card__eyebrow">
            <p class="section-label">处理结果</p>
            <span class="status-chip">${escapeHtml(code)}</span>
          </div>
          <h1>${escapeHtml(presentation.title)}</h1>
          <p class="hero-copy">${escapeHtml(presentation.message)}</p>
          <div class="result-card__meta">
            <span class="status-chip">${escapeHtml(themeStatus())}</span>
          </div>
        </header>
        <section class="result-card result-card--hint">
          <p class="section-label">下一步</p>
          <p>当前页面只承载失败结果。需要重试、进入设置或关闭回到记录页时，会由结果页按钮决定下一步。</p>
        </section>
        <div class="actions-row actions-row--result">
          ${presentation.showRetry ? '<button type="button" class="primary-button" id="result-retry">重试</button>' : ''}
          ${presentation.showOpenSettings ? '<button type="button" class="secondary-button" id="result-open-settings">前往设置</button>' : ''}
          ${presentation.showClose ? '<button type="button" class="secondary-button" id="result-close">关闭</button>' : ''}
        </div>
      </section>
    `)

    showView('result')
  }

  async function renderCurrentView() {
    applyTheme()

    if (state.view === 'settings') {
      renderSettings()
      return
    }

    if (state.view === 'result') {
      renderResult()
      return
    }

    await renderRecords()
  }

  async function refreshRecords() {
    state.loadingRecords = true
    state.warning = ''
    await renderRecords()

    try {
      const manifest = (await services.listSavedRecords?.()) || {}
      state.records = Array.isArray(manifest.records) ? manifest.records : []
    } catch {
      state.records = []
      state.warning = '读取钉住记录失败，请检查保存目录配置。'
    } finally {
      state.loadingRecords = false
      await renderRecords()
    }
  }

  async function retryWorkflow() {
    const result = await services.runCaptureTranslationPin?.()

    if (result?.ok === false) {
      switchView('result', result)
      return
    }

    state.result = null
    await refreshRecords()
  }

  async function updateWindowHeight(rawValue) {
    const parsedHeight = Math.floor(Number(rawValue))
    const nextUiSettings = services.saveUiSettings?.({ windowHeight: parsedHeight }) || state.uiSettings
    state.uiSettings = panelStateApi.normalizeUiSettings?.(nextUiSettings) || nextUiSettings

    if (typeof window.utools?.setExpendHeight === 'function') {
      window.utools.setExpendHeight(state.uiSettings.windowHeight)
    }

    renderSettings()
  }

  $(document).on('click', '#records-open-settings, #result-open-settings', () => {
    switchView('settings', state.result)
  })

  $(document).on('click', '#settings-open-records', async () => {
    state.result = null
    await refreshRecords()
  })

  $(document).on('click', '#result-close', async () => {
    state.result = null
    await refreshRecords()
  })

  $(document).on('click', '#result-retry', async () => {
    await retryWorkflow()
  })

  $(document).on('click', '[data-action=\"open-resource-link\"]', async function handleOpenResourceLink(event) {
    event.preventDefault()
    const url = $(this).data('url')
    const opened = await services.openExternalLink?.(url)

    if (!opened && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  })

  $(document).on('input', '#records-column-count', async function handleColumnCountInput() {
    const nextUiSettings = services.saveUiSettings?.({ recordsColumnCount: Number($(this).val()) }) || state.uiSettings
    state.uiSettings = panelStateApi.normalizeUiSettings?.(nextUiSettings) || nextUiSettings
    await renderRecords()
  })

  $(document).on('click', '[data-action=\"repin-record\"]', async function handleRepinRecord() {
    const recordId = String($(this).data('record-id') || '').trim()
    if (!recordId) {
      return
    }

    const result = await services.repinSavedRecord?.(recordId)

    if (result?.ok === false && result.code !== 'already-pinned') {
      switchView('result', result)
      return
    }

    await refreshRecords()
  })

  $(document).on('click', '[data-action=\"delete-record\"]', async function handleDeleteRecord() {
    const recordId = String($(this).data('record-id') || '').trim()
    if (!recordId) {
      return
    }

    if (state.pluginSettings.confirmBeforeDelete) {
      const confirmed = window.confirm(`确认删除 ${recordId} 吗？`)
      if (!confirmed) {
        return
      }
    }

    try {
      await services.deleteSavedRecord?.(recordId)
      await refreshRecords()
    } catch {
      state.warning = '删除记录失败，请稍后再试。'
      await renderRecords()
    }
  })

  $(document).on('input', '#credential-app-id', function handleAppIdInput() {
    const nextCredentials = services.saveTranslationCredentials?.({ appId: $(this).val() }) || state.translationCredentials
    state.translationCredentials =
      panelStateApi.normalizeTranslationCredentials?.(nextCredentials) || nextCredentials
    renderSettings()
  })

  $(document).on('input', '#credential-access-token', function handleAccessTokenInput() {
    const nextCredentials =
      services.saveTranslationCredentials?.({ accessToken: $(this).val() }) || state.translationCredentials
    state.translationCredentials =
      panelStateApi.normalizeTranslationCredentials?.(nextCredentials) || nextCredentials
    renderSettings()
  })

  $(document).on('change', '#translation-mode', function handleTranslationModeChange() {
    const nextPluginSettings =
      services.savePluginSettings?.({ translationMode: String($(this).val()) }) || state.pluginSettings
    state.pluginSettings = panelStateApi.normalizePluginSettings?.(nextPluginSettings) || nextPluginSettings
    renderSettings()
  })

  $(document).on('change', '#save-translated-image', function handleSaveTranslatedImageChange() {
    const nextPluginSettings =
      services.savePluginSettings?.({ saveTranslatedImage: Boolean($(this).prop('checked')) }) ||
      state.pluginSettings
    state.pluginSettings = panelStateApi.normalizePluginSettings?.(nextPluginSettings) || nextPluginSettings
    renderSettings()
  })

  $(document).on('input', '#save-directory', function handleSaveDirectoryInput() {
    const nextPluginSettings =
      services.savePluginSettings?.({ saveDirectory: String($(this).val()) }) || state.pluginSettings
    state.pluginSettings = panelStateApi.normalizePluginSettings?.(nextPluginSettings) || nextPluginSettings
    renderSettings()
  })

  $(document).on('click', '#settings-pick-directory', async () => {
    const selectedDirectory = await services.pickSaveDirectory?.()
    if (!selectedDirectory) {
      return
    }

    const nextPluginSettings =
      services.savePluginSettings?.({ saveDirectory: selectedDirectory }) || state.pluginSettings
    state.pluginSettings = panelStateApi.normalizePluginSettings?.(nextPluginSettings) || nextPluginSettings
    renderSettings()
  })

  $(document).on('click', '#settings-open-directory', async () => {
    await services.openSaveDirectory?.()
  })

  $(document).on('change', '#confirm-before-delete', function handleConfirmBeforeDeleteChange() {
    const nextPluginSettings =
      services.savePluginSettings?.({ confirmBeforeDelete: Boolean($(this).prop('checked')) }) ||
      state.pluginSettings
    state.pluginSettings = panelStateApi.normalizePluginSettings?.(nextPluginSettings) || nextPluginSettings
    renderSettings()
  })

  $(document).on('change', '#theme-mode', function handleThemeModeChange() {
    const nextUiSettings = services.saveUiSettings?.({ themeMode: String($(this).val()) }) || state.uiSettings
    state.uiSettings = panelStateApi.normalizeUiSettings?.(nextUiSettings) || nextUiSettings
    applyTheme()
    renderSettings()
  })

  $(document).on('input', '#window-height', async function handleWindowHeightInput() {
    await updateWindowHeight($(this).val())
  })

  $(document).on('click', '#settings-reset-height', async () => {
    await updateWindowHeight(panelStateApi.DEFAULT_UI_SETTINGS?.windowHeight || 640)
  })

  function attachSystemThemeListener() {
    if (typeof window.matchMedia !== 'function') {
      return
    }

    const systemThemeQuery = window.matchMedia(SYSTEM_THEME_QUERY)
    state.prefersDark = systemThemeQuery.matches

    const handleThemeChange = (event) => {
      state.prefersDark = Boolean(event?.matches)
      void renderCurrentView()
    }

    if (typeof systemThemeQuery.addEventListener === 'function') {
      systemThemeQuery.addEventListener('change', handleThemeChange)
      return
    }

    if (typeof systemThemeQuery.addListener === 'function') {
      systemThemeQuery.addListener(handleThemeChange)
    }
  }

  function applyPanelState(nextState) {
    const candidate = nextState && typeof nextState === 'object' ? nextState : {}
    state.view = normalizeView(candidate.view ?? state.view)
    state.result = candidate.result ?? state.result
    void renderCurrentView()
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener(PANEL_INIT_EVENT, (event) => {
      applyPanelState(event.detail)
    })
  }

  attachSystemThemeListener()
  readSnapshot()

  if (window.__PANEL_INIT__) {
    applyPanelState(window.__PANEL_INIT__)
  } else {
    void renderCurrentView()
  }

  if (state.view === 'records') {
    void refreshRecords()
  }
})()
