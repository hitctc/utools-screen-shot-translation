(function (global) {
  const RECORD_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const DEFAULT_UI_SETTINGS = {
    themeMode: 'system',
    windowHeight: 640,
    recordsColumnCount: 4,
  }

  const DEFAULT_PLUGIN_SETTINGS = {
    translationMode: 'auto',
    saveTranslatedImage: false,
    saveDirectory: '',
    confirmBeforeDelete: true,
  }

  const DEFAULT_TRANSLATION_CREDENTIALS = {
    appId: '',
    accessToken: '',
  }

  const THEME_OPTIONS = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ]

  const TRANSLATION_MODE_OPTIONS = [
    { value: 'auto', label: '自动识别' },
    { value: 'en-to-zh', label: '英文 -> 中文' },
    { value: 'zh-to-en', label: '中文 -> 英文' },
  ]

  const WINDOW_HEIGHT_MIN = 480
  const WINDOW_HEIGHT_MAX = 960
  const WINDOW_HEIGHT_STEP = 20
  const RECORDS_COLUMN_COUNT_OPTIONS = [3, 4, 5]
  const RECORDS_COLUMN_COUNT_MIN = 3
  const RECORDS_COLUMN_COUNT_MAX = 5

  // 页面壳只保留最小转义能力，避免把记录 id、目录路径和失败文案直接插进 HTML。
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  // 主题模式只接受三态，其余值统一回落到跟随系统。
  function normalizeUiSettings(raw) {
    const candidate = raw && typeof raw === 'object' ? raw : {}
    const themeMode = ['system', 'light', 'dark'].includes(String(candidate.themeMode))
      ? String(candidate.themeMode)
      : DEFAULT_UI_SETTINGS.themeMode
    const parsedWindowHeight = Math.floor(Number(candidate.windowHeight))
    const parsedColumnCount = Math.floor(Number(candidate.recordsColumnCount))

    return {
      themeMode,
      windowHeight:
        Number.isFinite(parsedWindowHeight) && parsedWindowHeight >= WINDOW_HEIGHT_MIN && parsedWindowHeight <= WINDOW_HEIGHT_MAX
          ? parsedWindowHeight
          : DEFAULT_UI_SETTINGS.windowHeight,
      recordsColumnCount:
        Number.isFinite(parsedColumnCount) && parsedColumnCount >= RECORDS_COLUMN_COUNT_MIN && parsedColumnCount <= RECORDS_COLUMN_COUNT_MAX
          ? parsedColumnCount
          : DEFAULT_UI_SETTINGS.recordsColumnCount,
    }
  }

  // 插件设置沿用现有持久化契约，jQuery 层不再扩字段。
  function normalizePluginSettings(raw) {
    const candidate = raw && typeof raw === 'object' ? raw : {}
    const translationMode = ['auto', 'en-to-zh', 'zh-to-en'].includes(String(candidate.translationMode))
      ? String(candidate.translationMode)
      : DEFAULT_PLUGIN_SETTINGS.translationMode

    return {
      translationMode,
      saveTranslatedImage:
        typeof candidate.saveTranslatedImage === 'boolean'
          ? candidate.saveTranslatedImage
          : DEFAULT_PLUGIN_SETTINGS.saveTranslatedImage,
      saveDirectory:
        typeof candidate.saveDirectory === 'string'
          ? candidate.saveDirectory.trim()
          : DEFAULT_PLUGIN_SETTINGS.saveDirectory,
      confirmBeforeDelete:
        typeof candidate.confirmBeforeDelete === 'boolean'
          ? candidate.confirmBeforeDelete
          : DEFAULT_PLUGIN_SETTINGS.confirmBeforeDelete,
    }
  }

  // 百度 V2 现在只看 AppID 和 Access Token。
  function normalizeTranslationCredentials(raw) {
    const candidate = raw && typeof raw === 'object' ? raw : {}

    return {
      appId: typeof candidate.appId === 'string' ? candidate.appId.trim() : DEFAULT_TRANSLATION_CREDENTIALS.appId,
      accessToken:
        typeof candidate.accessToken === 'string'
          ? candidate.accessToken.trim()
          : DEFAULT_TRANSLATION_CREDENTIALS.accessToken,
    }
  }

  function resolveTheme(themeMode, prefersDark) {
    return themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode
  }

  function formatThemeStatus(themeMode, prefersDark) {
    const resolvedTheme = resolveTheme(themeMode, prefersDark)

    if (themeMode === 'system') {
      return `跟随系统 / ${resolvedTheme === 'dark' ? '深色' : '浅色'}`
    }

    return resolvedTheme === 'dark' ? '深色' : '浅色'
  }

  // 结果页需要继续保留同一套失败码语义，避免页面壳迁移后文案漂移。
  function mapWorkflowFailureToResult(code) {
    switch (code) {
      case 'capture-cancelled':
        return {
          title: '截屏被取消',
          message: '你取消了截屏，这次流程没有继续往下执行。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
      case 'translation-failed':
        return {
          title: '翻译失败',
          message: '截屏已经完成，但翻译步骤没有成功。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
      case 'translation-config-invalid':
        return {
          title: '翻译配置不完整',
          message: '当前还没有在设置页填写完整的百度图片翻译 V2 凭证，请同时补全 AppID 和 Access Token。',
          showRetry: true,
          showOpenSettings: true,
          showClose: true,
        }
      case 'save-config-invalid':
        return {
          title: '保存配置还没准备好',
          message: '保存结果已开启，但还没有设置可写入的保存目录。',
          showRetry: false,
          showOpenSettings: true,
          showClose: true,
        }
      case 'save-failed':
        return {
          title: '结果保存失败',
          message: '翻译结果已经生成，但写入磁盘时出错了。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
      case 'peg-failed':
        return {
          title: '钉图失败',
          message: '这次没有把结果钉到屏幕上。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
      case 'repeg-failed':
        return {
          title: '重钉图失败',
          message: '记录页里的重钉动作暂时没有完成。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
      default:
        return {
          title: '这次没有完成钉图',
          message: '流程执行失败，请重试。',
          showRetry: true,
          showOpenSettings: false,
          showClose: true,
        }
    }
  }

  function getSaveDirectoryWarning(pluginSettings) {
    if (pluginSettings.saveTranslatedImage && !pluginSettings.saveDirectory.trim()) {
      return '已开启保存结果图片，但保存目录为空，请先填写保存目录。'
    }

    return ''
  }

  function getTranslationCredentialWarning(credentials) {
    const normalized = normalizeTranslationCredentials(credentials)

    if (normalized.appId && normalized.accessToken) {
      return ''
    }

    if (normalized.appId || normalized.accessToken) {
      return '百度图片翻译 V2 凭证尚未填写完整，请同时提供 AppID 和 Access Token。'
    }

    return ''
  }

  function formatRecordCreatedAtLabel(createdAt) {
    if (typeof createdAt !== 'string' || !createdAt.trim()) {
      return '时间未知'
    }

    const parsedDate = new Date(createdAt)
    return Number.isNaN(parsedDate.getTime()) ? '时间未知' : RECORD_DATE_FORMATTER.format(parsedDate)
  }

  function toRecordImagePath(imagePath) {
    if (imagePath.startsWith('file://')) {
      return imagePath
    }

    if (/^[A-Za-z]:[\\/]/.test(imagePath)) {
      return `file:///${encodeURI(imagePath.replace(/\\/g, '/'))}`
    }

    if (imagePath.startsWith('\\\\')) {
      return `file://${encodeURI(imagePath.replace(/\\/g, '/').replace(/^\/+/, ''))}`
    }

    if (imagePath.startsWith('/')) {
      return `file://${encodeURI(imagePath)}`
    }

    return imagePath
  }

  function mapSavedRecordToViewRecord(record, index, saveDirectory) {
    if (!record || typeof record.id !== 'string' || typeof record.imageFilename !== 'string') {
      return null
    }

    const imageFilename = record.imageFilename.trim()
    if (!imageFilename) {
      return null
    }

    const hasAbsolutePrefix =
      imageFilename.startsWith('/') ||
      imageFilename.startsWith('file://') ||
      /^[A-Za-z]:[\\/]/.test(imageFilename) ||
      imageFilename.startsWith('\\\\')
    const normalizedDirectory = typeof saveDirectory === 'string' ? saveDirectory.trim().replace(/[\\/]+$/, '') : ''
    const absoluteImagePath = hasAbsolutePrefix
      ? imageFilename
      : normalizedDirectory
        ? `${normalizedDirectory}/${imageFilename.replace(/^[/\\]+/, '')}`
        : imageFilename

    return {
      id: record.id,
      imagePath: toRecordImagePath(absoluteImagePath),
      createdAtLabel: formatRecordCreatedAtLabel(record.createdAt),
      orderLabel: `#${String(index + 1).padStart(2, '0')}`,
    }
  }

  // records 页的列数排布继续复用“按视觉列拆数组”的规则，避免 jQuery 壳和 Vue 壳行为不同。
  function splitRecordsIntoVisualColumns(records, columnCount) {
    const safeRecords = Array.isArray(records) ? records : []
    const safeColumnCount = Number.isFinite(columnCount) && columnCount > 0 ? Math.floor(columnCount) : 1

    if (!safeRecords.length) {
      return []
    }

    const actualColumnCount = Math.min(safeColumnCount, safeRecords.length)
    const columns = Array.from({ length: actualColumnCount }, () => [])

    safeRecords.forEach((record, index) => {
      columns[index % actualColumnCount].push(record)
    })

    return columns
  }

  function buildRecordsEmptyState(pluginSettings) {
    if (pluginSettings.saveTranslatedImage && !pluginSettings.saveDirectory) {
      return {
        title: '保存目录还没设置',
        copy: '先在设置里打开结果保存并配置目录，之后新翻译的结果才会进入记录页。',
      }
    }

    if (!pluginSettings.saveTranslatedImage) {
      return {
        title: '还没有可展示的记录',
        copy: '当前没有开启结果保存，所以这里只会展示已经落盘的翻译结果。',
      }
    }

    return {
      title: '保存目录里还没有记录',
      copy: '完成一次截屏翻译并成功保存后，这里会按时间倒序展示记录。',
    }
  }

  const api = {
    DEFAULT_UI_SETTINGS,
    DEFAULT_PLUGIN_SETTINGS,
    DEFAULT_TRANSLATION_CREDENTIALS,
    THEME_OPTIONS,
    TRANSLATION_MODE_OPTIONS,
    WINDOW_HEIGHT_MIN,
    WINDOW_HEIGHT_MAX,
    WINDOW_HEIGHT_STEP,
    RECORDS_COLUMN_COUNT_OPTIONS,
    RECORDS_COLUMN_COUNT_MIN,
    RECORDS_COLUMN_COUNT_MAX,
    escapeHtml,
    normalizeUiSettings,
    normalizePluginSettings,
    normalizeTranslationCredentials,
    resolveTheme,
    formatThemeStatus,
    mapWorkflowFailureToResult,
    getSaveDirectoryWarning,
    getTranslationCredentialWarning,
    mapSavedRecordToViewRecord,
    splitRecordsIntoVisualColumns,
    buildRecordsEmptyState,
  }

  global.ScreenTranslationPanelState = api
})(typeof window !== 'undefined' ? window : globalThis)
