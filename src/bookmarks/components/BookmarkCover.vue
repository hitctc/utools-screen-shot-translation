<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  title: string
  siteLabel: string
  pathLabel: string
  primaryMatchLabel: string
  displayNumber: number
  openCount: number
  showOpenCount: boolean
  keyboardActive: boolean
  titleSegments: Array<{ text: string; matched: boolean }>
  siteSegments: Array<{ text: string; matched: boolean }>
  pathSegments: Array<{ text: string; matched: boolean }>
}>()
const openCountLabel = computed(() => `打开 ${props.openCount} 次`)
const primaryMatchVariant = computed(() => {
  if (props.primaryMatchLabel === '标题') {
    return 'title'
  }

  if (props.primaryMatchLabel === '全拼') {
    return 'full-pinyin'
  }

  if (props.primaryMatchLabel === '简拼') {
    return 'initials'
  }

  if (props.primaryMatchLabel === '域名') {
    return 'domain'
  }

  if (props.primaryMatchLabel === '路径') {
    return 'path'
  }

  return 'default'
})

// 片段数据可能来自空字符串，这里统一兜底，保证模板渲染结构稳定。
function getStableSegments(segments: Array<{ text: string; matched: boolean }>, fallbackText: string) {
  if (Array.isArray(segments) && segments.length > 0) {
    return segments
  }

  return [{ text: fallbackText, matched: false }]
}

const stableTitleSegments = computed(() => getStableSegments(props.titleSegments, props.title))
const stableSiteSegments = computed(() => getStableSegments(props.siteSegments, props.siteLabel))
const stablePathSegments = computed(() => getStableSegments(props.pathSegments, props.pathLabel))
</script>

<template>
  <div class="bookmark-cover" :class="{ 'bookmark-cover--keyboard-active': keyboardActive }">
    <div class="bookmark-cover__meta-row">
      <span class="bookmark-cover__index" :title="`编号 ${displayNumber}`">{{ displayNumber }}</span>
      <p class="bookmark-cover__site" :title="siteLabel">
        <template v-for="(segment, index) in stableSiteSegments" :key="`site-${index}`">
          <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
          <span v-else>{{ segment.text }}</span>
        </template>
      </p>
    </div>

    <div class="bookmark-cover__body bookmark-cover__body--compact">
      <h3 class="bookmark-cover__title" :title="title">
        <template v-for="(segment, index) in stableTitleSegments" :key="`title-${index}`">
          <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
          <span v-else>{{ segment.text }}</span>
        </template>
      </h3>
    </div>

    <div class="bookmark-cover__footer">
      <span class="bookmark-cover__path">
        <span class="bookmark-cover__path-label">路径</span>
        <span class="bookmark-cover__path-value" :title="pathLabel">
          <template v-for="(segment, index) in stablePathSegments" :key="`path-${index}`">
            <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </span>
      </span>
      <div class="bookmark-cover__footer-stats">
        <span
          v-if="primaryMatchLabel"
          class="bookmark-cover__chip"
          :class="`bookmark-cover__chip--${primaryMatchVariant}`"
        >
          <span class="bookmark-cover__chip-marker" aria-hidden="true" />
          <span class="bookmark-cover__chip-text">{{ primaryMatchLabel }}</span>
        </span>
        <span v-if="showOpenCount && openCount > 0" class="bookmark-cover__count">{{ openCountLabel }}</span>
      </div>
    </div>
  </div>
</template>
