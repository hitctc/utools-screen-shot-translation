export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemeMode(themeMode, prefersDark) {
  if (themeMode === 'dark' || themeMode === 'light') {
    return themeMode
  }

  return prefersDark ? 'dark' : 'light'
}

export function formatThemeStatus(themeMode, resolvedTheme) {
  if (themeMode === 'dark') {
    return '深色'
  }

  if (themeMode === 'light') {
    return '浅色'
  }

  return `跟随 / ${resolvedTheme === 'dark' ? '深色' : '浅色'}`
}
