<script lang="ts" setup>
import { computed } from 'vue'
import BookmarkCover from './BookmarkCover.vue'
import { getBookmarkSearchMeta } from '../search'
import type { BookmarkCardItem } from '../types'

const props = withDefaults(
  defineProps<{
    item: BookmarkCardItem
    displayNumber: number
    keyboardActive?: boolean
    showOpenCount?: boolean
    searchTokens?: string[]
  }>(),
  {
    keyboardActive: false,
    showOpenCount: true,
    searchTokens: () => [],
  },
)

const emit = defineEmits<{
  (event: 'open', item: BookmarkCardItem): void
  (event: 'toggle-pin', item: BookmarkCardItem): void
}>()

const pinButtonLabel = computed(() => (props.item.isPinned ? '已置顶' : '置顶'))
const searchMeta = computed(() => getBookmarkSearchMeta(props.item, props.searchTokens))

// 打开动作只负责把 URL 交回上层，避免卡片组件自己绑定具体的打开实现。
function handleOpen() {
  emit('open', props.item)
}

// 置顶按钮先保留交互壳，后续接入本地状态时只需要补上父级监听。
function handleTogglePin(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('toggle-pin', props.item)
}
</script>

<template>
  <article class="bookmark-card" :class="{ 'bookmark-card--keyboard-active': keyboardActive }">
    <button
      type="button"
      class="bookmark-card__pin"
      :class="{ 'bookmark-card__pin--active': item.isPinned }"
      :title="pinButtonLabel"
      :aria-label="pinButtonLabel"
      @keydown.enter.stop
      @click="handleTogglePin"
    >
      <span class="bookmark-card__pin-text">{{ pinButtonLabel }}</span>
    </button>

    <button type="button" class="bookmark-card__open" @keydown.enter.stop @click="handleOpen">
      <BookmarkCover
        :title="searchMeta.title"
        :site-label="searchMeta.siteLabel"
        :path-label="searchMeta.pathLabel"
        :primary-match-label="searchMeta.primaryMatchLabel"
        :display-number="displayNumber"
        :open-count="item.openCount"
        :show-open-count="showOpenCount"
        :keyboard-active="keyboardActive"
        :title-segments="searchMeta.highlightedTitleSegments"
        :site-segments="searchMeta.highlightedSiteSegments"
        :path-segments="searchMeta.highlightedPathSegments"
      />
    </button>
  </article>
</template>
