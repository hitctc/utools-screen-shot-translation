<script setup lang="ts">
import {
  DEFAULT_UI_SETTINGS,
  PIN_PREVIEW_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  THEME_OPTIONS,
  WINDOW_HEIGHT_MAX,
  WINDOW_HEIGHT_MIN,
  WINDOW_HEIGHT_STEP,
  type PinPreviewMode,
  type PluginSettings,
  type ThemeMode,
  type UiSettings,
} from './types'

const props = defineProps<{
  pluginSettings: PluginSettings
  uiSettings: UiSettings
  themeStatus: string
}>()

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'save-plugin-settings', payload: Partial<PluginSettings>): void
  (event: 'save-ui-settings', payload: Partial<UiSettings>): void
}>()

// 翻译方向只改动对应字段，避免骨架页一次改动把另一侧语言重置掉。
function emitSourceLanguageChange(sourceLanguage: string) {
  emit('save-plugin-settings', { sourceLanguage })
}

// 目标语言是设置页里最明确的输出偏好，切换时立即同步到上层状态。
function emitTargetLanguageChange(targetLanguage: string) {
  emit('save-plugin-settings', { targetLanguage })
}

// 钉住预览目前只保留两种骨架模式，后续真实窗口接入时继续沿用这个入口。
function emitPinPreviewModeChange(pinPreviewMode: PinPreviewMode) {
  emit('save-plugin-settings', { pinPreviewMode })
}

// 主题设置继续沿用 preload 里的 UI 设置存储，不在组件内保留第二份状态。
function emitThemeModeChange(themeMode: ThemeMode) {
  emit('save-ui-settings', { themeMode })
}

// 窗口高度统一转成正整数，再交给上层归一化和持久化。
function emitWindowHeightChange(rawValue: string) {
  emit('save-ui-settings', { windowHeight: Math.floor(Number(rawValue)) })
}

// 恢复默认高度时直接复用默认 UI 设置，保持和 preload 边界一致。
function emitResetWindowHeight() {
  emit('save-ui-settings', { windowHeight: DEFAULT_UI_SETTINGS.windowHeight })
}
</script>

<template>
  <section class="page-shell page-shell--settings">
    <div class="actions-row actions-row--settings">
      <button type="button" class="secondary-button secondary-button--compact" @click="emit('back')">返回首页</button>
    </div>

    <section class="settings-card">
      <header class="settings-card__header">
        <p class="section-label">Translation Settings</p>
        <h1>设置</h1>
        <p class="settings-copy">这里先保留翻译和钉住相关配置骨架，后续再接入真实服务和窗口行为。</p>
      </header>

      <div class="settings-layout">
        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">翻译方向</p>
              <p class="group-copy">当前骨架仍然允许切换源语言和目标语言，便于后续直接接真实服务。</p>
            </div>
            <span class="status-chip">源 {{ pluginSettings.sourceLanguage }} / 目标 {{ pluginSettings.targetLanguage }}</span>
          </div>

          <div class="settings-fields settings-fields--split">
            <label class="field">
              <span class="field__label">源语言</span>
              <select class="field__control" :value="pluginSettings.sourceLanguage" @change="emitSourceLanguageChange(($event.target as HTMLSelectElement).value)">
                <option v-for="option in SOURCE_LANGUAGE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">目标语言</span>
              <select class="field__control" :value="pluginSettings.targetLanguage" @change="emitTargetLanguageChange(($event.target as HTMLSelectElement).value)">
                <option v-for="option in TARGET_LANGUAGE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">钉住预览</p>
              <p class="group-copy">这里只保留结果展示方式的骨架开关，实际钉住窗口仍待后续接入。</p>
            </div>
            <span class="status-chip">{{ pluginSettings.pinPreviewMode === 'overlay' ? '覆盖原图' : '并排预览' }}</span>
          </div>

          <div class="choice-row">
            <button
              v-for="option in PIN_PREVIEW_OPTIONS"
              :key="option.value"
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': pluginSettings.pinPreviewMode === option.value }"
              @click="emitPinPreviewModeChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">界面主题</p>
              <p class="group-copy">主题模式和首页展示共用一份 UI 设置，切换后首页状态条会同步变化。</p>
            </div>
            <span class="status-chip">{{ themeStatus }}</span>
          </div>

          <div class="choice-row">
            <button
              v-for="option in THEME_OPTIONS"
              :key="option.value"
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': uiSettings.themeMode === option.value }"
              @click="emitThemeModeChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">窗口高度</p>
              <p class="group-copy">主插件窗口当前只调高度，用这个范围控件保留后续接真实窗口的入口。</p>
            </div>
            <span class="status-chip">{{ uiSettings.windowHeight }} px</span>
          </div>

          <label class="field">
            <span class="field__label">窗口高度</span>
            <input
              class="range-control"
              type="range"
              :min="WINDOW_HEIGHT_MIN"
              :max="WINDOW_HEIGHT_MAX"
              :step="WINDOW_HEIGHT_STEP"
              :value="uiSettings.windowHeight"
              @input="emitWindowHeightChange(($event.target as HTMLInputElement).value)"
            />
          </label>

          <div class="range-meta">
            <span>{{ WINDOW_HEIGHT_MIN }} px</span>
            <span>{{ WINDOW_HEIGHT_MAX }} px</span>
          </div>

          <div class="actions-row">
            <button type="button" class="secondary-button secondary-button--compact" @click="emitResetWindowHeight">
              恢复默认高度
            </button>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
