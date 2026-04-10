<script setup lang="ts">
import type { ScreenTranslationRecord } from './types'

defineProps<{
  records: ScreenTranslationRecord[]
  loading: boolean
  emptyStateTitle: string
  emptyStateCopy: string
  themeStatus: string
}>()

const emit = defineEmits<{
  (event: 'repin-record', recordId: string): void
  (event: 'delete-record', recordId: string): void
  (event: 'open-settings'): void
}>()
</script>

<template>
  <section class="page-shell page-shell--records">
    <header class="hero-card hero-card--compact">
      <div class="hero-card__eyebrow">
        <p class="section-label">Screen Translation</p>
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
      <h1>钉住记录</h1>
      <p class="hero-copy">
        当前页面先承载已保存的钉住记录。真实记录桥接、重钉和删除确认会在后续任务里接入，这里只保留记录页壳和空态。
      </p>
    </header>

    <section v-if="loading" class="state-card state-card--hint">
      <p class="section-label">Loading</p>
      <p>正在整理记录列表，请稍候。</p>
    </section>

    <section v-else-if="records.length" class="records-grid" aria-label="钉住记录列表">
      <article v-for="record in records" :key="record.id" class="record-card">
        <button
          type="button"
          class="record-card__preview"
          @click="emit('repin-record', record.id)"
        >
          <img class="record-card__image" :src="record.imagePath" :alt="record.orderLabel" />
          <span class="record-card__overlay">
            <span class="record-card__order">{{ record.orderLabel }}</span>
            <span class="record-card__action">重钉</span>
          </span>
        </button>

        <div class="record-card__meta">
          <span>{{ record.orderLabel }}</span>
          <span>{{ record.createdAtLabel }}</span>
        </div>

        <div class="record-card__actions">
          <button type="button" class="secondary-button secondary-button--compact" @click="emit('repin-record', record.id)">
            重新钉住
          </button>
          <button
            type="button"
            class="secondary-button secondary-button--compact secondary-button--danger"
            @click="emit('delete-record', record.id)"
          >
            删除
          </button>
        </div>
      </article>
    </section>

    <section v-else class="empty-state">
      <p class="section-label">Empty State</p>
      <h2>{{ emptyStateTitle }}</h2>
      <p class="empty-state__copy">
        {{ emptyStateCopy }}
      </p>
    </section>

    <div class="actions-row actions-row--home">
      <button type="button" class="secondary-button" @click="emit('open-settings')">设置</button>
    </div>
  </section>
</template>
