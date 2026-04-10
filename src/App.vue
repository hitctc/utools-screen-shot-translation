<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import HomeView from './screenTranslation/HomeView.vue'
import SettingsView from './screenTranslation/SettingsView.vue'
import {
  DEFAULT_PLUGIN_SETTINGS,
  DEFAULT_UI_SETTINGS,
  WINDOW_HEIGHT_MAX,
  WINDOW_HEIGHT_MIN,
  type PinPreviewMode,
  type PluginSettings,
  type ScreenTranslationStep,
  type ScreenTranslationView,
  type ThemeMode,
  type UiSettings,
} from './screenTranslation/types'
import {
  SYSTEM_THEME_QUERY,
  formatThemeStatus,
  resolveThemeMode,
  syncPrefersDarkState,
} from './screenTranslation/theme.js'

type ServicesBridge = {
  getUiSettings?: () => UiSettings
  saveUiSettings?: (partial: Partial<UiSettings>) => UiSettings
  getPluginSettings?: () => PluginSettings
  savePluginSettings?: (partial: Partial<PluginSettings>) => PluginSettings
}

const currentView = ref<ScreenTranslationView>('home')
const currentStep = ref<ScreenTranslationStep>('capture')
const processing = ref(false)
const homeError = ref('')
const uiSettings = ref<UiSettings>({ ...DEFAULT_UI_SETTINGS })
const pluginSettings = ref<PluginSettings>({ ...DEFAULT_PLUGIN_SETTINGS })
const prefersDark = ref(false)
let systemThemeQuery: MediaQueryList | null = null

const resolvedThemeMode = computed(() =>
  resolveThemeMode(uiSettings.value.themeMode, prefersDark.value),
)
const themeStatus = computed(() =>
  formatThemeStatus(uiSettings.value.themeMode, resolvedThemeMode.value),
)
const captureStateText = computed(() =>
  currentStep.value === 'capture'
    ? '等待开始一次新的截屏流程。'
    : '截屏骨架已推进，后续会在这里替换成真实截图结果。',
)
const translationStateText = computed(() => {
  if (currentStep.value === 'capture') {
    return '需要先完成截屏，翻译结果占位才会出现。'
  }

  if (currentStep.value === 'translate') {
    return '翻译阶段已经激活，下一步会在这里接入 OCR 与翻译服务。'
  }

  return '翻译结果骨架已准备好，可以继续进入钉住展示。'
})
const pinStateText = computed(() =>
  currentStep.value === 'pin'
    ? '钉住骨架已准备，但当前版本还不会真的创建钉住窗口。'
    : '等待翻译阶段完成后，再把结果钉住到屏幕。',
)

// 本地兜底也要和 preload 的窗口边界一致，避免浏览器预览模式表现跑偏。
function clampWindowHeight(windowHeight: number) {
  return Math.min(Math.max(windowHeight, WINDOW_HEIGHT_MIN), WINDOW_HEIGHT_MAX)
}

// 读取到的 UI 设置可能来自浏览器预览或旧存储，这里统一裁成骨架页可接受的形状。
function normalizeUiSettings(raw: Partial<UiSettings> | null | undefined): UiSettings {
  const candidate = raw && typeof raw === 'object' ? raw : {}
  const themeMode = ['system', 'dark', 'light'].includes(String(candidate.themeMode))
    ? (candidate.themeMode as ThemeMode)
    : DEFAULT_UI_SETTINGS.themeMode
  const parsedWindowHeight = Math.floor(Number(candidate.windowHeight))

  return {
    themeMode,
    windowHeight:
      Number.isFinite(parsedWindowHeight) && parsedWindowHeight > 0
        ? clampWindowHeight(parsedWindowHeight)
        : DEFAULT_UI_SETTINGS.windowHeight,
  }
}

// 插件设置只保留翻译方向和钉住预览模式，避免旧业务字段再次混入新骨架。
function normalizePluginSettings(raw: Partial<PluginSettings> | null | undefined): PluginSettings {
  const candidate = raw && typeof raw === 'object' ? raw : {}
  const sourceLanguage =
    typeof candidate.sourceLanguage === 'string' && candidate.sourceLanguage.trim()
      ? candidate.sourceLanguage.trim()
      : DEFAULT_PLUGIN_SETTINGS.sourceLanguage
  const targetLanguage =
    typeof candidate.targetLanguage === 'string' && candidate.targetLanguage.trim()
      ? candidate.targetLanguage.trim()
      : DEFAULT_PLUGIN_SETTINGS.targetLanguage
  const pinPreviewMode = ['overlay', 'side-by-side'].includes(String(candidate.pinPreviewMode))
    ? (candidate.pinPreviewMode as PinPreviewMode)
    : DEFAULT_PLUGIN_SETTINGS.pinPreviewMode

  return {
    sourceLanguage,
    targetLanguage,
    pinPreviewMode,
  }
}

// 所有 preload 调用都先走统一入口，这样浏览器预览模式下也能安全降级。
function getServices() {
  if (typeof window === 'undefined' || !window.services || typeof window.services !== 'object') {
    return null
  }

  return window.services as ServicesBridge
}

// 主题切换只依赖一份 data-theme，首页和设置页都从同一个根节点变量取色。
function applyThemeMode() {
  document.documentElement.dataset.theme = resolvedThemeMode.value
}

// 主插件窗口当前只有高度配置，切换设置时直接把最新值同步给 uTools。
function applyPluginWindowHeight(windowHeight: number) {
  if (typeof window.utools?.setExpendHeight === 'function') {
    window.utools.setExpendHeight(windowHeight)
  }
}

// 每次 UI 设置变化后都统一刷新主题和窗口高度，避免两个副作用各自分叉。
function syncUiPresentation() {
  applyThemeMode()
  applyPluginWindowHeight(uiSettings.value.windowHeight)
}

// 打开插件或收到 DB 拉新时，都复用同一套持久化设置回填逻辑。
function readPersistedState() {
  const services = getServices()

  uiSettings.value = normalizeUiSettings(services?.getUiSettings?.() ?? uiSettings.value)
  pluginSettings.value = normalizePluginSettings(services?.getPluginSettings?.() ?? pluginSettings.value)
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

// 所有骨架动作都先统一切 processing，再执行最小状态迁移，避免按钮重复点击。
function runProcessingAction(action: () => void) {
  homeError.value = ''
  processing.value = true

  try {
    action()
  } finally {
    processing.value = false
  }
}

// 截屏动作当前只推进到翻译阶段，后续真实截图接入后继续复用这个入口。
function startCapture() {
  runProcessingAction(() => {
    currentStep.value = 'translate'
  })
}

// 翻译动作要求用户先完成截屏骨架，否则首页直接提示当前阻塞点。
function startTranslate() {
  if (currentStep.value === 'capture') {
    homeError.value = '请先完成截屏骨架，再进入翻译。'
    return
  }

  runProcessingAction(() => {
    currentStep.value = 'pin'
  })
}

// 钉住动作目前只给出受控提示，明确当前版本还停留在骨架替换阶段。
function startPin() {
  if (currentStep.value !== 'pin') {
    homeError.value = '请先完成翻译骨架，再尝试钉住。'
    return
  }

  runProcessingAction(() => {
    homeError.value = '当前版本还未接入真实钉住能力。'
  })
}

// 首页和设置页之间只切视图，不再保留旧书签页面的额外副状态。
function openSettings() {
  currentView.value = 'settings'
}

// 返回首页时保留当前三步流状态，方便继续从骨架的当前位置往后看。
function goHome() {
  currentView.value = 'home'
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

// 插件设置只持久化当前页展示的字段，避免未来真实能力接入前再引入额外状态。
function savePluginSettings(partial: Partial<PluginSettings>) {
  const services = getServices()
  const nextSettings = services?.savePluginSettings?.(partial) ?? {
    ...pluginSettings.value,
    ...partial,
  }

  pluginSettings.value = normalizePluginSettings(nextSettings)
}

onMounted(() => {
  attachSystemThemeListener()
  readPersistedState()

  if (!getServices()) {
    homeError.value = '当前处于浏览器预览模式，状态保存和真实能力桥接尚未注入。'
  }

  if (typeof window.utools?.onPluginEnter === 'function') {
    window.utools.onPluginEnter(() => {
      currentView.value = 'home'
      currentStep.value = 'capture'
      homeError.value = ''
      readPersistedState()
    })
  }

  if (typeof window.utools?.onDbPull === 'function') {
    window.utools.onDbPull(() => {
      readPersistedState()
    })
  }
})

onBeforeUnmount(() => {
  detachSystemThemeListener()
})
</script>

<template>
  <HomeView
    v-if="currentView === 'home'"
    :processing="processing"
    :current-step="currentStep"
    :capture-state-text="captureStateText"
    :translation-state-text="translationStateText"
    :pin-state-text="pinStateText"
    :error="homeError"
    :theme-status="themeStatus"
    @start-capture="startCapture"
    @start-translate="startTranslate"
    @start-pin="startPin"
    @open-settings="openSettings"
  />

  <SettingsView
    v-else
    :plugin-settings="pluginSettings"
    :ui-settings="uiSettings"
    :theme-status="themeStatus"
    @back="goHome"
    @save-plugin-settings="savePluginSettings"
    @save-ui-settings="saveUiSettings"
  />
</template>
