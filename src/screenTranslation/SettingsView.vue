<script setup lang="ts">
import { computed } from 'vue'
import {
  DEFAULT_UI_SETTINGS,
  TRANSLATION_MODE_OPTIONS,
  THEME_OPTIONS,
  WINDOW_HEIGHT_MAX,
  WINDOW_HEIGHT_MIN,
  WINDOW_HEIGHT_STEP,
  type PluginSettings,
  type ThemeMode,
  type UiSettings,
} from './types'
import { getSaveDirectoryWarning } from './pluginSettings.js'

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

const saveDirectoryWarning = computed(() => getSaveDirectoryWarning(props.pluginSettings))

function emitPluginSettingChange(partial: Partial<PluginSettings>) {
  emit('save-plugin-settings', partial)
}

// 这块只切换翻译方向骨架，不再回写旧的源语言 / 目标语言组合。
function emitTranslationModeChange(translationMode: PluginSettings['translationMode']) {
  emitPluginSettingChange({ translationMode })
}

// 保存结果图片是独立开关，只有开启后目录字段才会被当成有效保存配置。
function emitSaveTranslatedImageChange(saveTranslatedImage: boolean) {
  emitPluginSettingChange({ saveTranslatedImage })
}

// 目录选择器还没接入前，先让用户直接编辑路径字符串，至少能把契约链路打通。
function emitSaveDirectoryChange(saveDirectory: string) {
  emitPluginSettingChange({ saveDirectory })
}

// 删除前二次确认要独立保留，避免后续接入真实删除动作时还沿用旧预览状态。
function emitConfirmBeforeDeleteChange(confirmBeforeDelete: boolean) {
  emitPluginSettingChange({ confirmBeforeDelete })
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
        <p class="settings-copy">这里先把翻译保存相关契约接通，目录选择和真实删除流程后续再补。</p>
      </header>

      <div class="settings-layout">
        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">翻译方向</p>
              <p class="group-copy">当前只保留翻译模式，后续接真实翻译服务时再把映射细节接进去。</p>
            </div>
            <span class="status-chip">
              {{ TRANSLATION_MODE_OPTIONS.find((option) => option.value === pluginSettings.translationMode)?.label ?? pluginSettings.translationMode }}
            </span>
          </div>

          <div class="choice-row">
            <button
              v-for="option in TRANSLATION_MODE_OPTIONS"
              :key="option.value"
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': pluginSettings.translationMode === option.value }"
              @click="emitTranslationModeChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">保存结果图片</p>
              <p class="group-copy">开启后才会把翻译后的图片视为需要落盘的结果。</p>
            </div>
            <span class="status-chip">{{ pluginSettings.saveTranslatedImage ? '已开启' : '已关闭' }}</span>
          </div>

          <div class="choice-row">
            <button
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': pluginSettings.saveTranslatedImage }"
              @click="emitSaveTranslatedImageChange(true)"
            >
              开启
            </button>
            <button
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': !pluginSettings.saveTranslatedImage }"
              @click="emitSaveTranslatedImageChange(false)"
            >
              关闭
            </button>
          </div>

          <p v-if="saveDirectoryWarning" class="field__hint field__hint--warning">
            {{ saveDirectoryWarning }}
          </p>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">保存目录</p>
              <p class="group-copy">目录选择器还没接入前，先用文本输入框保存路径字符串。</p>
            </div>
            <span class="status-chip">{{ pluginSettings.saveDirectory || '未设置' }}</span>
          </div>

          <label class="field">
            <span class="field__label">保存目录</span>
            <input
              class="field__control"
              type="text"
              :value="pluginSettings.saveDirectory"
              placeholder="/Users/you/Pictures/translation"
              @input="emitSaveDirectoryChange(($event.target as HTMLInputElement).value)"
            />
          </label>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <div>
              <p class="group-title">删除前二次确认</p>
              <p class="group-copy">后续接删除动作时，这个开关会决定是否先弹出确认步骤。</p>
            </div>
            <span class="status-chip">{{ pluginSettings.confirmBeforeDelete ? '需要确认' : '直接删除' }}</span>
          </div>

          <div class="choice-row">
            <button
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': pluginSettings.confirmBeforeDelete }"
              @click="emitConfirmBeforeDeleteChange(true)"
            >
              需要确认
            </button>
            <button
              type="button"
              class="choice-button"
              :class="{ 'choice-button--active': !pluginSettings.confirmBeforeDelete }"
              @click="emitConfirmBeforeDeleteChange(false)"
            >
              直接删除
            </button>
          </div>
        </section>
      </div>

      <section class="settings-card__footer">
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
      </section>
    </section>
  </section>
</template>
