<script lang="ts" setup>
const props = defineProps<{
  title: string
  count: number
}>()
</script>

<template>
  <section class="bookmarks-section">
    <header class="bookmarks-section__header">
      <p class="mono-label">{{ props.title }}</p>
      <span class="bookmarks-section__count">[ {{ count }} ]</span>
    </header>
    <div class="bookmarks-section__body">
      <slot />
    </div>
  </section>
</template>
