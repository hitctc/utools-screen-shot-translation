<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import HomeView from './screenTranslation/HomeView.vue'
import ResultView from './screenTranslation/ResultView.vue'
import SettingsView from './screenTranslation/SettingsView.vue'
import {
  DEFAULT_PLUGIN_SETTINGS,
  DEFAULT_TRANSLATION_CREDENTIALS,
  DEFAULT_UI_SETTINGS,
  RECORDS_COLUMN_COUNT_MAX,
  RECORDS_COLUMN_COUNT_MIN,
  WINDOW_HEIGHT_MAX,
  WINDOW_HEIGHT_MIN,
  type PluginSettings,
  type ScreenTranslationRecord,
  type ScreenTranslationView,
  type ThemeMode,
  type TranslationCredentials,
  type UiSettings,
  type WorkflowFailureCode,
  type WorkflowResultPresentation,
} from './screenTranslation/types'
import {
  SYSTEM_THEME_QUERY,
  formatThemeStatus,
  resolveThemeMode,
  syncPrefersDarkState,
} from './screenTranslation/theme.js'
import { createUnknownPluginEnterResult } from './screenTranslation/entryFlow.js'
import { normalizePluginSettings, normalizeTranslationCredentials } from './screenTranslation/pluginSettings.js'
import {
  mapSavedRecordToViewRecord,
  mapWorkflowFailureToResult,
  splitRecordsIntoVisualColumns,
} from './screenTranslation/viewState.js'

type WorkflowBridgeResult = {
  ok: boolean
  code: string
  translationDebug?: Record<string, unknown> | null
}

type RecordBridgeResult = {
  ok: boolean
  code?: string
}

type SavedRecordEntry = {
  id?: string
  imageFilename?: string
  createdAt?: string
}

type SavedRecordManifest = {
  records?: SavedRecordEntry[]
}

type ServicesBridge = {
  consumePendingPluginEnter?: () => { code?: string } | null
  consumePendingWorkflowResult?: () => WorkflowBridgeResult | null
  getUiSettings?: () => UiSettings
  saveUiSettings?: (partial: Partial<UiSettings>) => UiSettings
  getPluginSettings?: () => PluginSettings
  savePluginSettings?: (partial: Partial<PluginSettings>) => PluginSettings
  getTranslationCredentials?: () => TranslationCredentials
  saveTranslationCredentials?: (partial: Partial<TranslationCredentials>) => TranslationCredentials
  getLastTranslationDebug?: () => Record<string, unknown> | null
  pickSaveDirectory?: () => Promise<string>
  openSaveDirectory?: () => Promise<boolean> | boolean
  openExternalLink?: (url: string) => Promise<boolean> | boolean
  listSavedRecords?: () => Promise<SavedRecordManifest>
  deleteSavedRecord?: (recordId: string) => Promise<unknown>
  repinSavedRecord?: (recordId: string) => Promise<RecordBridgeResult>
  runCaptureTranslationPin?: () => Promise<WorkflowBridgeResult>
}

const WORKFLOW_RESULT_EVENT = 'screen-shot-translation:workflow-result'

// run 入口需要静默执行，初始态先不渲染任何页面，等 feature code 再决定承载面。
const currentView = ref<ScreenTranslationView>('idle')
const records = ref<ScreenTranslationRecord[]>([])
const recordsLoading = ref(false)
const uiSettings = ref<UiSettings>({ ...DEFAULT_UI_SETTINGS })
const pluginSettings = ref<PluginSettings>({ ...DEFAULT_PLUGIN_SETTINGS })
const translationCredentials = ref<TranslationCredentials>({ ...DEFAULT_TRANSLATION_CREDENTIALS })
const workflowResult = ref<WorkflowResultState>(createEmptyWorkflowResultState())
const prefersDark = ref(false)
const previewWarningMessage = ref('')
const recordsWarningMessage = ref('')
const resultRetryMode = ref<'workflow' | 'repin' | ''>('')
const resultRetryRecordId = ref('')
let systemThemeQuery: MediaQueryList | null = null
let workflowResultEventListener: ((event: Event) => void) | null = null

type WorkflowResultState = WorkflowResultPresentation & {
  visible: boolean
  code: string
}

type TranslationDebugInfo = {
  errorCode?: string
  errorMessage?: string
  fallbackErrorCode?: string
  fallbackErrorMessage?: string
  composedImageStrategy?: string
  attemptedPasteMode?: number
  fallbackPasteMode?: number
}

const resolvedThemeMode = computed(() =>
  resolveThemeMode(uiSettings.value.themeMode, prefersDark.value),
)
const themeStatus = computed(() =>
  formatThemeStatus(uiSettings.value.themeMode, resolvedThemeMode.value),
)
// 瀑布流布局要按列拆数据，这里保留单独的视图模型，避免组件里再推导顺序。
const recordColumns = computed(() =>
  splitRecordsIntoVisualColumns(records.value, uiSettings.value.recordsColumnCount),
)
const recordsEmptyStateTitle = '暂时还没有钉住记录'
const recordsEmptyStateCopy = computed(() =>
  previewWarningMessage.value
    ? `${previewWarningMessage.value} 当前保存目录里还没有可展示的钉住记录。`
    : '当前保存目录里还没有可展示的钉住记录。',
)

// 本地兜底也要和 preload 的窗口边界一致，避免浏览器预览模式表现跑偏。
function clampWindowHeight(windowHeight: number) {
  return Math.min(Math.max(windowHeight, WINDOW_HEIGHT_MIN), WINDOW_HEIGHT_MAX)
}

// 读取到的 UI 设置可能来自浏览器预览或旧存储，这里统一裁成页面可接受的形状。
function normalizeUiSettings(raw: Partial<UiSettings> | null | undefined): UiSettings {
  const candidate = raw && typeof raw === 'object' ? raw : {}
  const themeMode = ['system', 'dark', 'light'].includes(String(candidate.themeMode))
    ? (candidate.themeMode as ThemeMode)
    : DEFAULT_UI_SETTINGS.themeMode
  const parsedWindowHeight = Math.floor(Number(candidate.windowHeight))
  const parsedRecordsColumnCount = Math.floor(Number(candidate.recordsColumnCount))

  return {
    themeMode,
    windowHeight:
      Number.isFinite(parsedWindowHeight) && parsedWindowHeight > 0
        ? clampWindowHeight(parsedWindowHeight)
        : DEFAULT_UI_SETTINGS.windowHeight,
    recordsColumnCount:
      Number.isFinite(parsedRecordsColumnCount) && parsedRecordsColumnCount > 0
        ? Math.min(Math.max(parsedRecordsColumnCount, RECORDS_COLUMN_COUNT_MIN), RECORDS_COLUMN_COUNT_MAX)
        : DEFAULT_UI_SETTINGS.recordsColumnCount,
  }
}

// 所有 preload 调用都先走统一入口，这样浏览器预览模式下也能安全降级。
function getServices() {
  if (typeof window === 'undefined' || !window.services || typeof window.services !== 'object') {
    return null
  }

  return window.services as ServicesBridge
}

// 主题切换只依赖一份 data-theme，首页、设置页和结果页都从同一个根节点变量取色。
function applyThemeMode() {
  document.documentElement.dataset.theme = resolvedThemeMode.value
}

// 主插件窗口当前只有高度配置，切换设置时直接把最新值同步给 uTools。
function applyPluginWindowHeight(windowHeight: number) {
  if (typeof window.utools?.setExpendHeight === 'function') {
    window.utools.setExpendHeight(windowHeight)
  }
}

// run 入口会先把主窗口收起来，后续只要要展示记录页、设置页或失败结果，就显式拉回主窗口。
function ensureMainWindowVisible() {
  if (typeof window.utools?.showMainWindow === 'function') {
    try {
      window.utools.showMainWindow()
    } catch {
      // 主窗口可见性恢复失败时保留静默兜底，避免再把失败态扩大成新的页面异常。
    }
  }
}

// 每次 UI 设置变化后都统一刷新主题和窗口高度，避免两个副作用各自分叉。
function syncUiPresentation() {
  applyThemeMode()
  applyPluginWindowHeight(uiSettings.value.windowHeight)
}

// 统一的结果态先放在 App 里，后续失败码和结果页都沿着这个对象继续长。
function createEmptyWorkflowResultState(): WorkflowResultState {
  return {
    visible: false,
    code: '',
    title: '',
    message: '',
    showRetry: false,
    showOpenSettings: false,
    showClose: false,
  }
}

// 结果页状态统一由这个入口写入，保持显示内容和按钮开关一起更新。
function setWorkflowFailure(
  code: string,
  override?: Partial<WorkflowResultPresentation>,
  retryMode: 'workflow' | 'repin' | '' = 'workflow',
  retryRecordId = '',
) {
  ensureMainWindowVisible()
  workflowResult.value = {
    visible: true,
    code,
    ...mapWorkflowFailureToResult(code),
    ...override,
  }
  resultRetryMode.value = retryMode
  resultRetryRecordId.value = retryRecordId
  currentView.value = 'result'
}

// 进入记录页前先把失败态清掉，避免上一轮流程文案残留到新的视图里。
function goRecords() {
  ensureMainWindowVisible()
  currentView.value = 'records'
  workflowResult.value = createEmptyWorkflowResultState()
  recordsWarningMessage.value = ''
  resultRetryMode.value = ''
  resultRetryRecordId.value = ''
  recordsLoading.value = false
  void refreshRecords()
}

// 设置页只做视图切换，不额外保留旧的结果态。
function openSettings() {
  ensureMainWindowVisible()
  currentView.value = 'settings'
  workflowResult.value = createEmptyWorkflowResultState()
}

// 记录页和结果页都可能回到记录页，这里统一复用同一个关闭动作。
function closeResult() {
  goRecords()
}

// 记录页进入时优先读 preload 里的总清单；桥接不可用或没有记录时，统一回到受控空态。
async function refreshRecords() {
  const services = getServices()

  recordsLoading.value = true
  recordsWarningMessage.value = ''

  try {
    const manifest = await services?.listSavedRecords?.()
    const nextRecords = Array.isArray(manifest?.records)
      ? manifest.records
          .map((record, index) => mapSavedRecordToViewRecord(record, index, pluginSettings.value.saveDirectory))
          .filter((record): record is ScreenTranslationRecord => Boolean(record))
      : []

    records.value = nextRecords
  } catch {
    records.value = []
    recordsWarningMessage.value = '读取钉住记录失败，请检查保存目录和总清单文件后重试。'
  } finally {
    recordsLoading.value = false
  }
}

// 记录页上的重钉统一走 preload 桥接，失败时再落到结果页统一提示。
async function repinRecord(recordId: string) {
  const services = getServices()
  const result = await services?.repinSavedRecord?.(recordId)

  if (!result?.ok) {
    setWorkflowFailure(result?.code ?? 'repin-failed', undefined, 'repin', recordId)
  }
}

// 删除记录前先看保存配置是否要求确认，确认后再刷新记录列表。
async function deleteRecord(recordId: string) {
  const services = getServices()

  if (!services?.deleteSavedRecord) {
    return
  }

  if (pluginSettings.value.confirmBeforeDelete) {
    const shouldDelete = typeof window.confirm === 'function'
      ? window.confirm('确定删除这条保存记录吗？')
      : true

    if (!shouldDelete) {
      return
    }
  }

  let deleteFailed = false

  try {
    await services.deleteSavedRecord(recordId)
  } catch {
    deleteFailed = true
  } finally {
    await refreshRecords()
  }

  if (deleteFailed && !recordsWarningMessage.value) {
    recordsWarningMessage.value = '删除记录失败，请检查保存目录后重试。'
  }
}

// 选择保存目录只负责把桥接结果写回插件设置，不在这里伪造目录值。
async function pickSaveDirectory() {
  const services = getServices()
  const directory = await services?.pickSaveDirectory?.()

  if (directory) {
    savePluginSettings({ saveDirectory: directory })
    await refreshRecords()
  }
}

// 打开目录动作只负责透传给 preload，让系统能力继续收口在 bridge 里。
async function openSaveDirectory() {
  const services = getServices()

  await services?.openSaveDirectory?.()
}

// 设置页资源链接统一走 preload bridge，确保在 uTools 容器里也会落到系统浏览器。
async function openResourceLink(url: string) {
  const services = getServices()
  const openedByBridge = await services?.openExternalLink?.(url)

  if (!openedByBridge && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function formatBaiduErrorSummary(errorCode = '', errorMessage = '') {
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim() : ''
  const normalizedMessage = typeof errorMessage === 'string' ? errorMessage.trim() : ''

  if (normalizedCode && normalizedMessage) {
    return `${normalizedCode}：${normalizedMessage}`
  }

  return normalizedCode || normalizedMessage
}

// 翻译失败时优先把百度返回的真实错误原因映射成可读文案，避免结果页只有泛化失败。
function buildTranslationFailureOverride(debug: TranslationDebugInfo | null): Partial<WorkflowResultPresentation> | null {
  if (!debug || typeof debug !== 'object') {
    return null
  }

  const primaryErrorSummary = formatBaiduErrorSummary(debug.errorCode, debug.errorMessage)
  const fallbackErrorSummary = formatBaiduErrorSummary(debug.fallbackErrorCode, debug.fallbackErrorMessage)
  const attemptedPasteMode =
    typeof debug.attemptedPasteMode === 'number' ? `paste=${debug.attemptedPasteMode}` : 'paste=2'
  const fallbackPasteMode =
    typeof debug.fallbackPasteMode === 'number' ? `，回退 paste=${debug.fallbackPasteMode}` : ''

  if (debug.errorCode === '54001' || debug.errorCode === '55002' || debug.fallbackErrorCode === '54001' || debug.fallbackErrorCode === '55002') {
    return {
      message: `百度接口返回鉴权失败（${primaryErrorSummary || fallbackErrorSummary}）。请检查设置页里的 AppID 和 Access Token 是否匹配、是否过期。`,
      showOpenSettings: true,
    }
  }

  if (debug.errorCode === '55006' || debug.fallbackErrorCode === '55006') {
    return {
      message: `百度接口返回服务未开通（${primaryErrorSummary || fallbackErrorSummary}）。请先在开放平台确认图片翻译 V2 服务已经开通。`,
      showOpenSettings: true,
    }
  }

  if (primaryErrorSummary || fallbackErrorSummary) {
    return {
      message: `百度接口返回错误。首次尝试 ${attemptedPasteMode}${fallbackPasteMode}。${primaryErrorSummary ? `主请求：${primaryErrorSummary}。` : ''}${fallbackErrorSummary ? `回退请求：${fallbackErrorSummary}。` : ''}`,
    }
  }

  if (debug.composedImageStrategy === 'missing-image' || debug.composedImageStrategy === 'block-compose') {
    return {
      message: `百度翻译接口已返回文本结果，但没有生成可用的贴合图片。当前尝试 ${attemptedPasteMode}${fallbackPasteMode} 后仍未拿到可展示图片。`,
    }
  }

  return null
}

// 结果页的“重试”要跟着失败来源走，不能把重钉失败误导成重新开始截屏主流程。
async function retryWorkflowResult() {
  if (resultRetryMode.value === 'repin' && resultRetryRecordId.value) {
    await repinRecord(resultRetryRecordId.value)
    return
  }

  await runMainWorkflowEntry()
}

// 主流程结果统一在渲染层做结果页映射，run 入口和结果页重试共用这一套分支。
function handleWorkflowResult(result: WorkflowBridgeResult | null | undefined) {
  if (!result) {
    return
  }

  if (result.ok) {
    void refreshRecords()
    workflowResult.value = createEmptyWorkflowResultState()
    resultRetryMode.value = ''
    resultRetryRecordId.value = ''
    return
  }

  if (result.code === 'translation-failed') {
    const translationDebug = result.translationDebug as TranslationDebugInfo | null | undefined
    setWorkflowFailure(
      result.code as WorkflowFailureCode,
      buildTranslationFailureOverride(translationDebug ?? null) ?? undefined,
    )
    return
  }

  setWorkflowFailure(result.code as WorkflowFailureCode)
}

// 主流程只在 run 入口和结果页重试时触发，截图仍走官方 screenCapture。
async function runMainWorkflowEntry() {
  const services = getServices()

  recordsLoading.value = true
  workflowResult.value = createEmptyWorkflowResultState()
  resultRetryMode.value = 'workflow'
  resultRetryRecordId.value = ''

  try {
    const result = await services?.runCaptureTranslationPin?.()

    if (!result) {
      setWorkflowFailure('translation-failed', {
        title: '运行桥接还未注入',
        message: '当前环境还没有可用的运行桥接，请在 uTools 中重新打开插件后再试。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      })
      return
    }

    handleWorkflowResult(result)
  } finally {
    recordsLoading.value = false
  }
}

// UI 设置优先写回 preload；没有 bridge 时就用本地兜底结构保证界面还能预览。
function saveUiSettings(partial: Partial<UiSettings>) {
  const services = getServices()
  const nextSettings = services?.saveUiSettings?.(partial) ?? {
    ...uiSettings.value,
    ...partial,
  }

  uiSettings.value = normalizeUiSettings(nextSettings)
  syncUiPresentation()
}

// 记录页列数属于纯 UI 偏好，拖动滑块后立即落到 UiSettings，避免额外确认动作。
function updateRecordsColumnCount(recordsColumnCount: number) {
  saveUiSettings({ recordsColumnCount })
}

// 插件设置只持久化当前页展示的字段，避免未来真实能力接入前再引入额外状态。
function savePluginSettings(partial: Partial<PluginSettings>) {
  const services = getServices()
  const nextSettings = services?.savePluginSettings?.(partial) ?? {
    ...pluginSettings.value,
    ...partial,
  }

  pluginSettings.value = normalizePluginSettings(nextSettings)
}

// 百度凭证独立于普通插件设置，优先走同步数据库桥接，浏览器预览时退回内存态。
function saveTranslationCredentials(partial: Partial<TranslationCredentials>) {
  const services = getServices()
  const nextCredentials = services?.saveTranslationCredentials?.(partial) ?? {
    ...translationCredentials.value,
    ...partial,
  }

  translationCredentials.value = normalizeTranslationCredentials(nextCredentials)
}

// 打开插件或收到 DB 拉新时，都复用同一套持久化设置回填逻辑。
function readPersistedState() {
  const services = getServices()

  uiSettings.value = normalizeUiSettings(services?.getUiSettings?.() ?? uiSettings.value)
  pluginSettings.value = normalizePluginSettings(services?.getPluginSettings?.() ?? pluginSettings.value)
  translationCredentials.value = normalizeTranslationCredentials(
    services?.getTranslationCredentials?.() ?? translationCredentials.value,
  )
  syncUiPresentation()
}

// 系统主题变化时只刷新根节点主题，不额外引入新的响应式状态。
function handleSystemThemeChange(queryLike: MediaQueryList | MediaQueryListEvent | null = systemThemeQuery) {
  syncPrefersDarkState(prefersDark, queryLike)
  applyThemeMode()
}

// 系统主题监听只在跟随系统时生效，页面卸载时也要对应释放监听器。
function attachSystemThemeListener() {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  systemThemeQuery = window.matchMedia(SYSTEM_THEME_QUERY)
  handleSystemThemeChange(systemThemeQuery)

  if ('addEventListener' in systemThemeQuery) {
    systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    return
  }

  systemThemeQuery.addListener(handleSystemThemeChange)
}

// 监听器的解绑方式需要兼容旧版 MediaQueryList API，避免多次进入插件时叠加回调。
function detachSystemThemeListener() {
  if (!systemThemeQuery) {
    return
  }

  if ('removeEventListener' in systemThemeQuery) {
    systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
    return
  }

  systemThemeQuery.removeListener(handleSystemThemeChange)
}

// 所有入口都在渲染层统一收口；run 入口依赖 feature.mainHide 静默执行，不需要先展示主窗口。
async function handlePluginEnter(event: { code?: string } = {}) {
  readPersistedState()

  if (event.code === 'screen-shot-translation-settings') {
    openSettings()
    return
  }

  if (event.code === 'screen-shot-translation-records') {
    goRecords()
    return
  }

  if (event.code === 'screen-shot-translation-run' || event.code === undefined) {
    currentView.value = 'idle'
    return
  }

  workflowResult.value = {
    ...createUnknownPluginEnterResult(event.code),
    showRetry: false,
    showOpenSettings: false,
    showClose: true,
  }
  currentView.value = 'result'
}

onMounted(() => {
  attachSystemThemeListener()
  readPersistedState()
  void refreshRecords()
  const services = getServices()

  if (!services) {
    previewWarningMessage.value = '当前处于浏览器预览模式，状态保存和运行桥接尚未注入。'
    if (currentView.value === 'idle') {
      currentView.value = 'records'
    }
  } else {
    previewWarningMessage.value = ''
  }

  if (typeof window.utools?.onPluginEnter === 'function') {
    window.utools.onPluginEnter((event) => {
      void handlePluginEnter(event ?? {})
    })
  }

  if (typeof window.addEventListener === 'function') {
    workflowResultEventListener = (event) => {
      const detail = (event as CustomEvent<WorkflowBridgeResult | null | undefined>).detail
      handleWorkflowResult(detail)
    }
    window.addEventListener(WORKFLOW_RESULT_EVENT, workflowResultEventListener as EventListener)
  }

  const pendingEnter = services?.consumePendingPluginEnter?.()
  if (pendingEnter) {
    void handlePluginEnter(pendingEnter)
  }

  const pendingWorkflowResult = services?.consumePendingWorkflowResult?.()
  if (pendingWorkflowResult) {
    handleWorkflowResult(pendingWorkflowResult)
  }

  if (typeof window.utools?.onDbPull === 'function') {
    window.utools.onDbPull(() => {
      readPersistedState()
      void refreshRecords()
    })
  }
})

onBeforeUnmount(() => {
  detachSystemThemeListener()

  if (workflowResultEventListener && typeof window.removeEventListener === 'function') {
    window.removeEventListener(WORKFLOW_RESULT_EVENT, workflowResultEventListener as EventListener)
    workflowResultEventListener = null
  }
})
</script>

<template>
  <HomeView
    v-if="currentView === 'records'"
    :records="records"
    :record-columns="recordColumns"
    :loading="recordsLoading"
    :empty-state-title="recordsEmptyStateTitle"
    :empty-state-copy="recordsEmptyStateCopy"
    :warning="recordsWarningMessage"
    :theme-status="themeStatus"
    :records-column-count="uiSettings.recordsColumnCount"
    @repin-record="repinRecord"
    @delete-record="deleteRecord"
    @open-settings="openSettings"
    @update-records-column-count="updateRecordsColumnCount"
  />

  <SettingsView
    v-else-if="currentView === 'settings'"
    :plugin-settings="pluginSettings"
    :translation-credentials="translationCredentials"
    :ui-settings="uiSettings"
    :theme-status="themeStatus"
    @back="goRecords"
    @open-resource-link="openResourceLink"
    @open-save-directory="openSaveDirectory"
    @pick-save-directory="pickSaveDirectory"
    @save-plugin-settings="savePluginSettings"
    @save-translation-credentials="saveTranslationCredentials"
    @save-ui-settings="saveUiSettings"
  />

  <!-- idle 只给 run 入口留空白承载，不能再误落到失败结果页壳子。 -->
  <div v-else-if="currentView === 'idle'" aria-hidden="true"></div>

  <ResultView
    v-else-if="currentView === 'result'"
    :code="workflowResult.code"
    :title="workflowResult.title"
    :message="workflowResult.message"
    :theme-status="themeStatus"
    :show-retry="workflowResult.showRetry"
    :show-open-settings="workflowResult.showOpenSettings"
    :show-close="workflowResult.showClose"
    @retry="retryWorkflowResult"
    @open-settings="openSettings"
    @close="closeResult"
  />
</template>
