<script setup lang="ts">
import type { ScreenTranslationRecord } from './types'

defineProps<{
  records: ScreenTranslationRecord[]
  recordColumns: ScreenTranslationRecord[][]
  loading: boolean
  emptyStateTitle: string
  emptyStateCopy: string
  warning: string
  themeStatus: string
  recordsColumnCount: number
}>()

const emit = defineEmits<{
  (event: 'repin-record', recordId: string): void
  (event: 'delete-record', recordId: string): void
  (event: 'open-settings'): void
  (event: 'update-records-column-count', recordsColumnCount: number): void
}>()

// 列数滑块只接受整数档位，拖动时直接把当前档位抛给父层持久化。
function handleColumnCountInput(event: Event) {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  emit('update-records-column-count', Number(target.value))
}
</script>

<template>
  <section class="page-shell page-shell--records">
    <header class="hero-card hero-card--compact">
      <div class="hero-card__eyebrow">
        <p class="section-label">钉住记录</p>
        <span class="status-chip">{{ themeStatus }}</span>
      </div>
      <h1>钉住记录</h1>
      <p class="hero-copy">
        点击缩略图会按最后位置重新钉住，删除会按设置里的确认开关执行。
      </p>

      <div class="records-toolbar">
        <div class="records-toolbar__meta">
          <span class="section-label">记录总数</span>
          <strong class="records-toolbar__count">{{ records.length }} 条</strong>
        </div>

        <label class="records-toolbar__density" for="records-column-count">
          <span class="records-toolbar__density-label">列数</span>
          <input
            id="records-column-count"
            class="records-toolbar__slider"
            type="range"
            min="3"
            max="6"
            step="1"
            :value="recordsColumnCount"
            @input="handleColumnCountInput"
          />
          <span class="records-toolbar__density-value">{{ recordsColumnCount }} 列</span>
        </label>

        <div class="info-strip">
          <span class="info-strip__label">当前排布</span>
          <span class="info-strip__value">{{ recordsColumnCount }} 列瀑布流</span>
        </div>
      </div>
    </header>

    <p v-if="warning" class="state-card state-card--error">{{ warning }}</p>

    <section v-if="loading" class="state-card state-card--hint">
      <p class="section-label">正在加载</p>
      <p>正在整理记录列表，请稍候。</p>
    </section>

    <section
      v-else-if="records.length"
      class="records-grid"
      :style="{ '--records-column-count': String(recordColumns.length || 1) }"
      aria-label="钉住记录列表"
    >
      <div
        v-for="(columnRecords, columnIndex) in recordColumns"
        :key="`column-${columnIndex}`"
        class="records-grid__column"
      >
        <article v-for="record in columnRecords" :key="record.id" class="record-card">
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
      </div>
    </section>

    <section v-else class="empty-state">
      <p class="section-label">暂无记录</p>
      <h2>{{ emptyStateTitle }}</h2>
      <p class="empty-state__copy">
        {{ emptyStateCopy }}
      </p>
    </section>

    <div class="records-floating-action">
      <button type="button" class="secondary-button records-floating-action__button" @click="emit('open-settings')">
        设置
      </button>
    </div>
  </section>
</template>
