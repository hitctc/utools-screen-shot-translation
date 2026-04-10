<script setup lang="ts">
import { computed } from 'vue'
import type { ScreenTranslationStep } from './types'

const props = defineProps<{
  processing: boolean
  currentStep: ScreenTranslationStep
  captureStateText: string
  translationStateText: string
  pinStateText: string
  error: string
  themeStatus: string
}>()

defineEmits<{
  (event: 'start-capture'): void
  (event: 'start-translate'): void
  (event: 'start-pin'): void
  (event: 'open-settings'): void
}>()

const captureDisabled = computed(() => props.processing || props.currentStep !== 'capture')
const translateDisabled = computed(() => props.processing || props.currentStep !== 'translate')
const pinDisabled = computed(() => props.processing || props.currentStep !== 'pin')
</script>

<template>
  <section class="page-shell page-shell--home">
    <header class="hero-card">
      <div class="hero-card__eyebrow">
        <p class="section-label">Screen Translation</p>
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
      <h1>截屏 -> 翻译 -> 钉住</h1>
      <p class="hero-copy">当前版本先把主流程和设置入口搭起来，后续再接入真实截屏、OCR、翻译和钉住能力。</p>
    </header>

    <p v-if="error" class="state-card state-card--error">{{ error }}</p>

    <div class="step-grid">
      <section class="step-card" :class="{ 'step-card--active': currentStep === 'capture' }">
        <p class="step-card__index">1. 截屏</p>
        <h2>获取画面</h2>
        <p>{{ captureStateText }}</p>
        <button type="button" class="primary-button" :disabled="captureDisabled" @click="$emit('start-capture')">
          开始截屏
        </button>
      </section>

      <section class="step-card" :class="{ 'step-card--active': currentStep === 'translate' }">
        <p class="step-card__index">2. 翻译</p>
        <h2>生成结果</h2>
        <p>{{ translationStateText }}</p>
        <button type="button" class="primary-button" :disabled="translateDisabled" @click="$emit('start-translate')">
          开始翻译
        </button>
      </section>

      <section class="step-card" :class="{ 'step-card--active': currentStep === 'pin' }">
        <p class="step-card__index">3. 钉住</p>
        <h2>保持可见</h2>
        <p>{{ pinStateText }}</p>
        <button type="button" class="primary-button" :disabled="pinDisabled" @click="$emit('start-pin')">
          钉住结果
        </button>
      </section>
    </div>

    <section class="state-card state-card--hint">
      <p class="section-label">Flow Status</p>
      <p>现在只替换成三步流骨架。进入设置页后，可以继续确认翻译方向、钉住预览、主题和窗口高度。</p>
    </section>

    <div class="actions-row actions-row--home">
      <button type="button" class="secondary-button" @click="$emit('open-settings')">设置</button>
    </div>
  </section>
</template>
