<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    url: string
    size?: number
  }>(),
  {
    size: 44,
  },
)

// 头像只取短标识，优先保留可读的两位字母，让面板看起来更像设备标签。
function getDisplayLetter(value: string) {
  const text = value.trim()
  const compact = text.replace(/[^a-z0-9]/gi, '')
  if (compact.length >= 2) {
    return compact.slice(0, 2).toUpperCase()
  }

  return (text[0] || '?').toUpperCase()
}

const hostText = computed(() => {
  try {
    return new URL(props.url).host
  } catch {
    return ''
  }
})

const avatarLetter = computed(() => getDisplayLetter(hostText.value || props.title || props.url || '?'))
</script>

<template>
  <div
    class="bookmark-avatar"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <span class="bookmark-avatar__letter">{{ avatarLetter }}</span>
  </div>
</template>
