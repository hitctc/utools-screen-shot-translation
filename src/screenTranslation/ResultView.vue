<script setup lang="ts">
defineProps<{
  code: string
  title: string
  message: string
  themeStatus: string
  showRetry: boolean
  showOpenSettings: boolean
  showClose: boolean
}>()

const emit = defineEmits<{
  (event: 'retry'): void
  (event: 'open-settings'): void
  (event: 'close'): void
}>()
</script>

<template>
  <section class="page-shell page-shell--result">
    <header class="result-card">
      <div class="hero-card__eyebrow">
        <p class="section-label">处理结果</p>
        <span class="status-chip">{{ code || 'workflow' }}</span>
      </div>
      <h1>{{ title }}</h1>
      <p class="hero-copy">{{ message }}</p>
      <div class="result-card__meta">
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
    </header>

    <section class="result-card result-card--hint">
      <p class="section-label">下一步</p>
      <p>
        当前页面只承载失败结果。需要重试、进入设置或关闭回到记录页时，会由结果页按钮决定下一步。
      </p>
    </section>

    <div class="actions-row actions-row--result">
      <button v-if="showRetry" type="button" class="primary-button" @click="emit('retry')">重试</button>
      <button
        v-if="showOpenSettings"
        type="button"
        class="secondary-button"
        @click="emit('open-settings')"
      >
        前往设置
      </button>
      <button v-if="showClose" type="button" class="secondary-button" @click="emit('close')">
        关闭
      </button>
    </div>
  </section>
</template>
