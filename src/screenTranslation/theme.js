export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

// 主题模式优先尊重显式选择，只有跟随系统时才读取系统深浅色状态。
export function resolveThemeMode(themeMode, prefersDark) {
  if (themeMode === 'dark' || themeMode === 'light') {
    return themeMode
  }

  return prefersDark ? 'dark' : 'light'
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
