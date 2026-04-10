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
  type TranslationCredentials,
  type UiSettings,
} from './types'
import { getSaveDirectoryWarning, getTranslationCredentialWarning } from './pluginSettings.js'

const props = defineProps<{
  pluginSettings: PluginSettings
  translationCredentials: TranslationCredentials
  uiSettings: UiSettings
  themeStatus: string
}>()

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'pick-save-directory'): void
  (event: 'save-plugin-settings', payload: Partial<PluginSettings>): void
  (event: 'save-translation-credentials', payload: Partial<TranslationCredentials>): void
  (event: 'save-ui-settings', payload: Partial<UiSettings>): void
}>()

function emitPluginSettingChange(partial: Partial<PluginSettings>) {
  emit('save-plugin-settings', partial)
}

function emitTranslationModeChange(translationMode: PluginSettings['translationMode']) {
  emitPluginSettingChange({ translationMode })
}

function emitSaveTranslatedImageChange(saveTranslatedImage: boolean) {
  emitPluginSettingChange({ saveTranslatedImage })
}

function emitSaveDirectoryChange(saveDirectory: string) {
  emitPluginSettingChange({ saveDirectory })
}

function emitConfirmBeforeDeleteChange(confirmBeforeDelete: boolean) {
  emitPluginSettingChange({ confirmBeforeDelete })
}

function emitTranslationCredentialChange(partial: Partial<TranslationCredentials>) {
  emit('save-translation-credentials', partial)
}

function emitThemeModeChange(themeMode: ThemeMode) {
  emit('save-ui-settings', { themeMode })
}

function emitWindowHeightChange(rawValue: string) {
  emit('save-ui-settings', { windowHeight: Math.floor(Number(rawValue)) })
}

function emitResetWindowHeight() {
  emit('save-ui-settings', { windowHeight: DEFAULT_UI_SETTINGS.windowHeight })
}

const saveDirectoryWarning = computed(() => getSaveDirectoryWarning(props.pluginSettings))
const translationCredentialWarning = computed(() => getTranslationCredentialWarning(props.translationCredentials))
</script>

<template>
  <section class="page-shell page-shell--settings">
    <header class="settings-card settings-card--hero">
      <div class="hero-card__eyebrow">
        <p class="section-label">Screen Translation</p>
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
      <h1>设置</h1>
      <p class="settings-copy">
        这里只保留当前已经落地的字段。目录选择已经接通，重钉和真实删除流程还在后续任务里，这一页只负责保存契约。
      </p>
      <div class="actions-row actions-row--settings">
        <button type="button" class="secondary-button secondary-button--compact" @click="emit('back')">
          返回记录页
        </button>
      </div>
    </header>

    <section class="settings-grid">
      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">百度图片翻译凭证</p>
            <p class="group-copy">这里填写的 AppID 和 AppKey 会保存到 uTools 同步数据库，并跟随同一账号在多设备间同步。</p>
          </div>
          <span class="status-chip">
            {{ props.translationCredentials.appId && props.translationCredentials.appKey ? '已配置' : '未配置' }}
          </span>
        </div>

        <label class="field">
          <span class="field__label">baiduAppId</span>
          <input
            class="field__control"
            type="text"
            :value="props.translationCredentials.appId"
            placeholder="请输入百度图片翻译 AppID"
            @input="emitTranslationCredentialChange({ appId: ($event.target as HTMLInputElement).value })"
          />
        </label>

        <label class="field">
          <span class="field__label">baiduAppKey</span>
          <input
            class="field__control"
            type="password"
            :value="props.translationCredentials.appKey"
            placeholder="请输入百度图片翻译 AppKey"
            @input="emitTranslationCredentialChange({ appKey: ($event.target as HTMLInputElement).value })"
          />
        </label>

        <p v-if="translationCredentialWarning" class="field__hint field__hint--warning">
          {{ translationCredentialWarning }}
        </p>
      </article>

      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">翻译方向</p>
            <p class="group-copy">只保留翻译模式字段，后续接真实翻译服务时再补映射。</p>
          </div>
          <span class="status-chip">
            {{
              TRANSLATION_MODE_OPTIONS.find((option) => option.value === pluginSettings.translationMode)?.label ??
              pluginSettings.translationMode
            }}
          </span>
        </div>

        <label class="field">
          <span class="field__label">translationMode</span>
          <select
            class="field__control field__control--select"
            :value="pluginSettings.translationMode"
            @change="emitTranslationModeChange(($event.target as HTMLSelectElement).value as PluginSettings['translationMode'])"
          >
            <option v-for="option in TRANSLATION_MODE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </article>

      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">保存结果图片</p>
            <p class="group-copy">保存开关和目录一起组成有效配置，目录现在既可以手输，也可以通过系统选择器填写。</p>
          </div>
          <span class="status-chip">{{ pluginSettings.saveTranslatedImage ? '已开启' : '已关闭' }}</span>
        </div>

        <label class="field field--inline">
          <input
            type="checkbox"
            :checked="pluginSettings.saveTranslatedImage"
            @change="emitSaveTranslatedImageChange(($event.target as HTMLInputElement).checked)"
          />
          <span class="field__label">saveTranslatedImage</span>
        </label>

        <label class="field">
          <span class="field__label">saveDirectory</span>
          <input
            class="field__control"
            type="text"
            :value="pluginSettings.saveDirectory"
            placeholder="/Users/you/Pictures/translation"
            @input="emitSaveDirectoryChange(($event.target as HTMLInputElement).value)"
          />
        </label>

        <div class="actions-row">
          <button type="button" class="secondary-button secondary-button--compact" @click="emit('pick-save-directory')">
            选择保存目录
          </button>
        </div>

        <p v-if="saveDirectoryWarning" class="field__hint field__hint--warning">
          {{ saveDirectoryWarning }}
        </p>
      </article>

      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">删除前二次确认</p>
            <p class="group-copy">后续接删除动作时，这个开关会决定是否先弹出确认。</p>
          </div>
          <span class="status-chip">{{ pluginSettings.confirmBeforeDelete ? '需要确认' : '直接删除' }}</span>
        </div>

        <label class="field field--inline">
          <input
            type="checkbox"
            :checked="pluginSettings.confirmBeforeDelete"
            @change="emitConfirmBeforeDeleteChange(($event.target as HTMLInputElement).checked)"
          />
          <span class="field__label">confirmBeforeDelete</span>
        </label>
      </article>

      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">界面主题</p>
            <p class="group-copy">主题继续走同一份 UI 设置，首页和设置页会共用这组状态。</p>
          </div>
          <span class="status-chip">{{ themeStatus }}</span>
        </div>

        <label class="field">
          <span class="field__label">themeMode</span>
          <select
            class="field__control field__control--select"
            :value="uiSettings.themeMode"
            @change="emitThemeModeChange(($event.target as HTMLSelectElement).value as ThemeMode)"
          >
            <option v-for="option in THEME_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">windowHeight: {{ uiSettings.windowHeight }} px</span>
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
      </article>
    </section>
  </section>
</template>
