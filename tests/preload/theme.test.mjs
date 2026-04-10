import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, ref } from 'vue'
import {
  SYSTEM_THEME_QUERY,
  formatThemeStatus,
  resolveThemeMode,
  syncPrefersDarkState,
} from '../../src/screenTranslation/theme.js'

test('SYSTEM_THEME_QUERY keeps the media query used for dark mode detection', () => {
  assert.equal(SYSTEM_THEME_QUERY, '(prefers-color-scheme: dark)')
})

test('resolveThemeMode returns explicit theme values unchanged', () => {
  assert.equal(resolveThemeMode('dark', false), 'dark')
  assert.equal(resolveThemeMode('light', true), 'light')
})

test('resolveThemeMode maps system theme mode from prefersDark', () => {
  assert.equal(resolveThemeMode('system', true), 'dark')
  assert.equal(resolveThemeMode('system', false), 'light')
})

test('formatThemeStatus renders the selected mode and resolved theme', () => {
  assert.equal(formatThemeStatus('system', 'dark'), '跟随 / 深色')
})

test('formatThemeStatus keeps explicit theme modes as a single label', () => {
  assert.equal(formatThemeStatus('dark', 'dark'), '深色')
  assert.equal(formatThemeStatus('light', 'light'), '浅色')
})

test('syncPrefersDarkState refreshes the reactive base used by system theme mode', () => {
  const prefersDark = ref(false)
  const resolvedThemeMode = computed(() => resolveThemeMode('system', prefersDark.value))
  const themeStatus = computed(() => formatThemeStatus('system', resolvedThemeMode.value))

  syncPrefersDarkState(prefersDark, { matches: true })

  assert.equal(prefersDark.value, true)
  assert.equal(resolvedThemeMode.value, 'dark')
  assert.equal(themeStatus.value, '跟随 / 深色')
})
