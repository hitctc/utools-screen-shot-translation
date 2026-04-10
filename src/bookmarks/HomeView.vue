<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import BookmarksSection from './components/BookmarksSection.vue'
import BookmarkCard from './components/BookmarkCard.vue'
import { normalizeSearchTokens } from './search'
import type { BookmarkCardItem, BookmarkSection } from './types'

const props = defineProps({
  bootstrapped: {
    type: Boolean,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  refreshing: {
    type: Boolean,
    required: true,
  },
  refreshFailed: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
  sections: {
    type: Array,
    required: true,
  },
  highlightedCardKey: {
    type: String,
    default: '',
  },
  isSearchMode: {
    type: Boolean,
    required: true,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  emptyText: {
    type: String,
    default: '',
  },
  showOpenCount: {
    type: Boolean,
    required: true,
  },
  themeStatus: {
    type: String,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits<{
  (event: 'open-settings'): void
  (event: 'refresh-bookmarks'): void
  (event: 'open-bookmark', item: BookmarkCardItem): void
  (event: 'toggle-pin', item: BookmarkCardItem): void
}>()

const homeContentRef = ref<HTMLElement | null>(null)

// 搜索词在首页本地归一化，避免为了高亮能力再改动上层状态流。
const searchTokens = computed(() => normalizeSearchTokens(props.searchQuery))
const sectionsSignature = computed(() =>
  (props.sections as BookmarkSection[])
    .map(section => `${section.key}:${section.entries.map(entry => entry.cardKey).join(',')}`)
    .join('|'),
)

// 卡片编号按当前首页实际渲染顺序连续计算，保证用户看到的顺序和编号一致。
const sectionStartNumbers = computed(() => {
  let nextNumber = 1

  return (props.sections as BookmarkSection[]).reduce<Record<string, number>>((accumulator, section) => {
    accumulator[section.key] = nextNumber
    nextNumber += section.entries.length
    return accumulator
  }, {})
})

// 键盘高亮项变化后，把对应卡片滚动到当前可视区域内。
async function scrollHighlightedCardIntoView(cardKey: string) {
  if (!cardKey) {
    return
  }

  await nextTick()

  const cardElement = Array.from(
    homeContentRef.value?.querySelectorAll<HTMLElement>('[data-card-key]') ?? [],
  ).find(element => element.dataset.cardKey === cardKey)

  cardElement?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}

watch(
  [() => props.highlightedCardKey, sectionsSignature],
  ([cardKey]) => {
    void scrollHighlightedCardIntoView(cardKey)
  },
)

onMounted(() => {
  void scrollHighlightedCardIntoView(props.highlightedCardKey)
})
</script>

<template>
  <section class="page-shell page-shell--home">
    <section v-if="!bootstrapped" class="state-card" ref="homeContentRef">
      <p>请通过 uTools 接入开发模式进入插件。</p>
    </section>
    <section v-else-if="loading" class="state-card" ref="homeContentRef">
      <p>正在读取 Chrome 书签文件…</p>
    </section>
    <section v-else-if="error" class="state-card state-error" ref="homeContentRef">
      <p>{{ error }}</p>
    </section>
    <section v-else-if="!props.sections.length" class="state-card" ref="homeContentRef">
      <p>{{ props.emptyText || '当前没有可展示的书签结果。' }}</p>
    </section>
    <div v-else ref="homeContentRef" class="home-sections">
      <BookmarksSection
        v-for="section in (props.sections as BookmarkSection[])"
        :key="section.key"
        :title="section.title"
        :count="section.entries.length"
      >
        <div class="bookmark-grid">
          <article
            v-for="(entry, index) in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
            :data-card-key="entry.cardKey"
          >
            <BookmarkCard
              :item="entry.item"
              :display-number="sectionStartNumbers[section.key] + index"
              :show-open-count="props.showOpenCount"
              :keyboard-active="entry.cardKey === props.highlightedCardKey"
              :search-tokens="searchTokens"
              @open="emit('open-bookmark', $event)"
              @toggle-pin="emit('toggle-pin', $event)"
            />
          </article>
        </div>
      </BookmarksSection>
    </div>

    <div v-if="bootstrapped && !loading && !error" class="home-dock">
      <section class="state-strip">
        <div class="state-strip__chips">
          <span class="status-chip status-chip--muted">{{ themeStatus }}</span>
          <span v-if="props.refreshing" class="status-chip status-chip--muted">刷新中</span>
          <span v-else-if="props.refreshFailed" class="status-chip status-chip--danger">刷新失败</span>
          <span v-if="isSearchMode" class="status-chip status-chip--muted">搜索中</span>
          <span class="status-chip status-chip--muted">上下键选</span>
        </div>
      </section>

      <div class="home-dock__actions">
        <button
          type="button"
          class="icon-button floating-action-button home-dock__refresh"
          :disabled="props.refreshing"
          aria-label="刷新书签"
          :title="props.refreshing ? '刷新中' : '刷新书签'"
          @click="emit('refresh-bookmarks')"
        >
          <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-13.66-5.66" />
            <path d="M4 4v5h5" />
            <path d="M4 13a8 8 0 0 0 13.66 5.66" />
            <path d="M20 20v-5h-5" />
          </svg>
        </button>

        <button
          type="button"
          class="icon-button icon-button--settings floating-action-button home-dock__settings"
          aria-label="打开设置"
          title="设置"
          @click="emit('open-settings')"
        >
          <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
            <circle cx="15" cy="7" r="2.5" />
            <circle cx="9" cy="12" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>
