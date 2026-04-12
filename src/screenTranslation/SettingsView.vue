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
  (event: 'open-resource-link', url: string): void
  (event: 'pick-save-directory'): void
  (event: 'open-save-directory'): void
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
// 目录按钮共用同一份可用态，避免输入框里只有空白字符时仍然允许触发系统打开。
const hasSaveDirectory = computed(() => props.pluginSettings.saveDirectory.trim().length > 0)
</script>

<template>
  <section class="page-shell page-shell--settings">
    <header class="settings-card settings-card--hero">
      <div class="hero-card__eyebrow">
        <p class="section-label">设置</p>
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
      <h1>设置</h1>
      <p class="settings-copy">
        这里集中管理翻译、保存和界面配置。
      </p>
    </header>

    <section class="settings-grid">
      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">翻译凭证</p>
            <p class="group-copy">当前只使用百度图片翻译 V2，请同时填写 AppID 和 Access Token。</p>
            <div class="resource-links" aria-label="百度图片翻译相关链接">
              <a
                class="resource-link"
                href="https://fanyi-api.baidu.com/product/233"
                target="_blank"
                rel="noreferrer"
                @click.prevent="emit('open-resource-link', 'https://fanyi-api.baidu.com/product/233')"
              >
                图片翻译 V2.0 文档
              </a>
              <a
                class="resource-link"
                href="https://fanyi-api.baidu.com/"
                target="_blank"
                rel="noreferrer"
                @click.prevent="emit('open-resource-link', 'https://fanyi-api.baidu.com/')"
              >
                申请百度翻译开放平台
              </a>
            </div>
          </div>
        </div>

        <div class="info-strip">
          <span class="info-strip__label">当前状态</span>
          <span class="info-strip__value">
            {{
              props.translationCredentials.appId && props.translationCredentials.accessToken
                ? 'V2 已启用'
                : '未配置'
            }}
          </span>
        </div>

        <label class="field">
          <span class="field__label">百度 AppID</span>
          <input
            class="field__control"
            type="text"
            :value="props.translationCredentials.appId"
            placeholder="V2 需要 AppID"
            @input="emitTranslationCredentialChange({ appId: ($event.target as HTMLInputElement).value })"
          />
        </label>

        <label class="field">
          <span class="field__label">百度 Access Token</span>
          <input
            class="field__control"
            type="password"
            :value="props.translationCredentials.accessToken"
            placeholder="需要与 AppID 配合使用"
            @input="emitTranslationCredentialChange({ accessToken: ($event.target as HTMLInputElement).value })"
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
            <p class="group-copy">控制当前截图结果的翻译方向。</p>
          </div>
        </div>

        <div class="info-strip">
          <span class="info-strip__label">当前方向</span>
          <span class="info-strip__value">
            {{
              TRANSLATION_MODE_OPTIONS.find((option) => option.value === pluginSettings.translationMode)?.label ??
              pluginSettings.translationMode
            }}
          </span>
        </div>

        <label class="field">
          <span class="field__label">翻译方向</span>
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
            <p class="group-title">结果保存</p>
            <p class="group-copy">保存开关和目录一起组成有效配置，目录可以手动输入，也可以通过系统选择器填写。</p>
          </div>
        </div>

        <div class="info-strip">
          <span class="info-strip__label">当前状态</span>
          <span class="info-strip__value">{{ pluginSettings.saveTranslatedImage ? '已开启' : '已关闭' }}</span>
        </div>

        <label class="field field--inline">
          <input
            type="checkbox"
            :checked="pluginSettings.saveTranslatedImage"
            @change="emitSaveTranslatedImageChange(($event.target as HTMLInputElement).checked)"
          />
          <span class="field__label">保存翻译结果</span>
        </label>

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

        <div class="actions-row">
          <button type="button" class="secondary-button secondary-button--compact" @click="emit('pick-save-directory')">
            选择保存目录
          </button>
          <button
            type="button"
            class="secondary-button secondary-button--compact"
            :disabled="!hasSaveDirectory"
            @click="emit('open-save-directory')"
          >
            打开目录
          </button>
        </div>

        <p v-if="saveDirectoryWarning" class="field__hint field__hint--warning">
          {{ saveDirectoryWarning }}
        </p>
      </article>

      <article class="settings-card">
        <div class="settings-card__header">
          <div>
            <p class="group-title">删除行为</p>
            <p class="group-copy">控制删除记录时是否先弹出确认提示。</p>
          </div>
        </div>

        <div class="info-strip">
          <span class="info-strip__label">当前状态</span>
          <span class="info-strip__value">{{ pluginSettings.confirmBeforeDelete ? '需要确认' : '直接删除' }}</span>
        </div>

        <label class="field field--inline">
          <input
            type="checkbox"
            :checked="pluginSettings.confirmBeforeDelete"
            @change="emitConfirmBeforeDeleteChange(($event.target as HTMLInputElement).checked)"
          />
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

        <div class="info-strip">
          <span class="info-strip__label">当前主题</span>
          <span class="info-strip__value">{{ themeStatus }}</span>
        </div>

        <label class="field">
          <span class="field__label">主题模式</span>
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
          <span class="field__label">窗口高度: {{ uiSettings.windowHeight }} px</span>
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

    <div class="settings-floating-action">
      <button type="button" class="secondary-button settings-floating-action__button" @click="emit('back')">
        返回记录页
      </button>
    </div>
  </section>
</template>
