export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

// 主题模式优先尊重显式选择，只有跟随系统时才读取系统深浅色状态。
export function resolveThemeMode(themeMode, prefersDark) {
  if (themeMode === 'dark' || themeMode === 'light') {
    return themeMode
  }

  return prefersDark ? 'dark' : 'light'
}

// 系统主题监听回调需要把最新 matches 写进响应式 ref，App 里的计算属性才会重新求值。
export function syncPrefersDarkState(prefersDarkRef, queryLike) {
  prefersDarkRef.value = Boolean(queryLike && 'matches' in queryLike ? queryLike.matches : false)
}

// 首页和设置页共用同一份主题文案，避免两个页面出现不一致的标签。
export function formatThemeStatus(themeMode, resolvedTheme) {
  if (themeMode === 'dark') {
    return '深色'
  }

  if (themeMode === 'light') {
    return '浅色'
  }

  return `跟随 / ${resolvedTheme === 'dark' ? '深色' : '浅色'}`
}
