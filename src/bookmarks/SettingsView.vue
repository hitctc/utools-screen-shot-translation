<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

const WINDOW_HEIGHT_MIN = 480
const WINDOW_HEIGHT_MAX = 960
const WINDOW_HEIGHT_STEP = 20

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  themeMode: {
    type: String,
    required: true,
  },
  showRecentOpened: {
    type: Boolean,
    required: true,
  },
  showOpenCount: {
    type: Boolean,
    required: true,
  },
  windowHeight: {
    type: Number,
    required: true,
  },
  defaultWindowHeight: {
    type: Number,
    required: true,
  },
  saving: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['back', 'save', 'reset', 'reload', 'change-ui-settings'])
const localPath = ref(props.modelValue)
const localWindowHeight = ref(String(props.windowHeight))
const resetWindowHeightLabel = computed(() => `恢复默认高度（${props.defaultWindowHeight} px）`)
const rangeProgress = computed(() => {
  const height = Number(localWindowHeight.value)
  const safeHeight = Number.isFinite(height) ? height : props.windowHeight
  const progress = ((safeHeight - WINDOW_HEIGHT_MIN) / (WINDOW_HEIGHT_MAX - WINDOW_HEIGHT_MIN)) * 100
  return `${Math.min(Math.max(progress, 0), 100)}%`
})
watch(
  () => props.modelValue,
  value => {
    localPath.value = value
  },
)
watch(
  () => props.windowHeight,
  value => {
    localWindowHeight.value = String(value)
  },
)

// 设置页始终以本地输入框内容为准，避免用户编辑中被外部状态打断。
function emitSave() {
  emit('save', localPath.value)
}

// 允许用户用当前输入路径直接试读，不必先保存。
function emitReload() {
  emit('reload', localPath.value)
}

// 选择文件只负责把系统文件选择结果回填到输入框，不在这里直接触发保存。
function pickBookmarkFile() {
  const files = window.utools?.showOpenDialog?.({
    title: '选择 Chrome Bookmarks 文件',
    buttonLabel: '使用这个文件',
    properties: ['openFile'],
  })

  if (!Array.isArray(files) || !files[0]) {
    return
  }

  localPath.value = String(files[0])
}

// 设置页的展示开关即时生效，不要求用户额外点保存按钮。
function emitUiSettingChange(key: 'showRecentOpened' | 'showOpenCount', checked: boolean) {
  emit('change-ui-settings', { [key]: checked })
}

// 主题模式只负责当前选项切换，不改动其他设置字段。
function emitThemeModeChange(themeMode: 'system' | 'dark' | 'light') {
  emit('change-ui-settings', { themeMode })
}

// 窗口高度提交时统一转成正整数，非法输入交给上层回退到默认值。
function emitWindowHeightChange(rawValue: string) {
  const normalizedValue = rawValue.trim()
  const parsedHeight = Math.floor(Number(normalizedValue))

  emit('change-ui-settings', {
    windowHeight: Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : undefined,
  })
}

// 恢复默认高度时沿用现有设置归一化逻辑，不额外维护第二份默认值。
function emitResetWindowHeight() {
  emit('change-ui-settings', { windowHeight: undefined })
}
</script>

<template>
  <section class="page-shell page-shell--settings">
    <button
      type="button"
      class="icon-button icon-button--back floating-action-button settings-floating-action"
      aria-label="返回首页"
      title="返回首页"
      @click="emit('back')"
    >
      <span class="icon-button__glyph" aria-hidden="true">←</span>
      <span class="icon-button__label">首页</span>
    </button>

    <section class="settings-card">
      <header class="settings-hero">
        <p class="section-label">Chrome Bookmarks</p>
        <div class="settings-hero__body">
          <div class="settings-hero__content">
            <h1>设置与展示偏好</h1>
            <p class="settings-copy">
              目前仅支持 macOS 下的 Chrome 默认 profile。首页直接显示书签；搜索请使用 uTools 顶部输入框，多个关键词用空格分隔。
            </p>
          </div>
          <p class="settings-note">
            如果不是默认 profile，请将路径改为对应的 Bookmarks 文件后保存或刷新。
          </p>
        </div>
      </header>

      <div class="settings-grid">
        <section class="settings-group settings-group--path">
          <div class="settings-group__header">
            <div>
              <p class="mono-label">数据来源</p>
              <h2>书签文件路径</h2>
            </div>
            <p class="settings-group__summary">
              默认读取 Chrome 的 Default profile，你也可以把这里切到其他 profile 的 Bookmarks 文件。
            </p>
          </div>

          <label class="field-label" for="bookmark-path">当前读取路径</label>
          <div class="path-field">
            <input
              id="bookmark-path"
              v-model="localPath"
              class="path-input path-field__input"
              type="text"
              placeholder="/Users/你的用户名/Library/Application Support/Google/Chrome/Default/Bookmarks"
            />
            <button
              type="button"
              class="secondary-button path-field__button"
              :disabled="saving"
              @click="pickBookmarkFile"
            >
              选择文件
            </button>
          </div>

          <p v-if="error" class="field-error">错误：{{ error }}</p>
          <p v-else class="field-hint">可以手填路径，也可以点右侧按钮直接选择本地 Bookmarks 文件。</p>

          <div class="actions-row actions-row--path">
            <button class="primary-button" :disabled="saving" @click="emitSave">保存并读取</button>
            <button class="secondary-button" :disabled="saving" @click="emit('reset')">恢复默认路径</button>
            <button class="secondary-button" :disabled="saving" @click="emitReload">按当前路径刷新</button>
          </div>
        </section>

        <section class="settings-group settings-group--compact">
          <div class="settings-group__header">
            <div>
              <p class="mono-label">外观</p>
              <h2>主题模式</h2>
            </div>
            <p class="settings-group__summary">主题切换会即时生效，首页状态条也会同步更新。</p>
          </div>

          <div class="segmented-control" role="tablist" aria-label="主题模式">
            <button
              type="button"
              class="segmented-control__button"
              :class="{ 'segmented-control__button--active': themeMode === 'system' }"
              @click="emitThemeModeChange('system')"
            >
              跟随系统
            </button>
            <button
              type="button"
              class="segmented-control__button"
              :class="{ 'segmented-control__button--active': themeMode === 'dark' }"
              @click="emitThemeModeChange('dark')"
            >
              深色
            </button>
            <button
              type="button"
              class="segmented-control__button"
              :class="{ 'segmented-control__button--active': themeMode === 'light' }"
              @click="emitThemeModeChange('light')"
            >
              浅色
            </button>
          </div>
        </section>

        <section class="settings-group settings-group--compact">
          <div class="settings-group__header">
            <div>
              <p class="mono-label">窗口</p>
              <h2>插件窗口高度</h2>
            </div>
            <p class="settings-group__summary">调整后会立即生效，关闭并重新进入插件后会继续沿用当前高度。</p>
          </div>

          <label class="field-label" for="window-height">高度</label>
          <p class="field-hint">uTools 主插件窗口目前只支持设置高度，不支持单独设置宽度。</p>
          <div class="range-control" :style="{ '--range-progress': rangeProgress }">
            <div class="range-control__header">
              <p class="mono-label">当前高度</p>
              <span class="status-chip">{{ localWindowHeight }} px</span>
            </div>
            <input
              id="window-height"
              v-model="localWindowHeight"
              class="range-control__input"
              type="range"
              :min="WINDOW_HEIGHT_MIN"
              :max="WINDOW_HEIGHT_MAX"
              :step="WINDOW_HEIGHT_STEP"
              @input="emitWindowHeightChange(($event.target as HTMLInputElement).value)"
            />
            <div class="range-control__bounds" aria-hidden="true">
              <span>{{ WINDOW_HEIGHT_MIN }} px</span>
              <span>{{ WINDOW_HEIGHT_MAX }} px</span>
            </div>
            <div class="range-control__actions">
              <button type="button" class="secondary-button range-control__reset" @click="emitResetWindowHeight">
                {{ resetWindowHeightLabel }}
              </button>
            </div>
          </div>
        </section>

        <section class="settings-group settings-group--compact settings-group--display">
          <div class="settings-group__header">
            <div>
              <p class="mono-label">首页展示</p>
              <h2>显示选项</h2>
            </div>
            <p class="settings-group__summary">这些开关会即时生效，不需要额外点击保存。</p>
          </div>

          <div class="settings-toggle-list">
            <label class="settings-toggle">
              <span>
                <strong>首页显示最近打开</strong>
                <small>打开后会在首页展示最近打开过的书签分区。</small>
              </span>
              <input
                :checked="showRecentOpened"
                class="settings-toggle__input"
                type="checkbox"
                @change="emitUiSettingChange('showRecentOpened', ($event.target as HTMLInputElement).checked)"
              />
            </label>

            <label class="settings-toggle">
              <span>
                <strong>显示打开次数</strong>
                <small>打开后会在书签卡片右下角显示累计打开次数。</small>
              </span>
              <input
                :checked="showOpenCount"
                class="settings-toggle__input"
                type="checkbox"
                @change="emitUiSettingChange('showOpenCount', ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
